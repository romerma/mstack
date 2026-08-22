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
 * A store whose root is an mstack checkout: this repository's own launcher,
 * source, plugin manifest and package.json, byte-copied into a scratch repo.
 * Copied rather than symlinked on purpose — the launcher resolves symlinks, so
 * a symlinked copy would resolve back here and stop being a *different* copy.
 * The manifest is what makes it a checkout at all: `isMstackCheckout` keys on
 * `.claude-plugin/plugin.json` naming mstack, because the file markers alone
 * false-positived on an ordinary project (see the wrapper-repo test below).
 * package.json rides along because every real checkout shape — clone, worktree,
 * installed cache — carries it with `"type": "module"`; without it, node 22.6's
 * type-stripping fallback prints a MODULE_TYPELESS_PACKAGE_JSON warning on
 * stderr and the empty-stderr assertions below fail on a fixture shape no real
 * deployment has. The real file, not a stub, so the fixture stays faithful as
 * the file evolves.
 *
 * Everything is committed, because the worktree and clone tests below need a
 * tree that `git worktree add` and `git clone` can reproduce.
 */
function scratchCheckout(): string {
  const root = scratchRepo();
  cpSync(join(ROOT, "bin"), join(root, "bin"), { recursive: true });
  cpSync(join(ROOT, "src"), join(root, "src"), { recursive: true });
  cpSync(join(ROOT, ".claude-plugin"), join(root, ".claude-plugin"), { recursive: true });
  cpSync(join(ROOT, "package.json"), join(root, "package.json"));
  const setup = run(root, join(root, "bin", "mstack"), ["setup"]);
  assert.equal(setup.status, 0, `setup failed: ${setup.stderr}`);
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "checkout tree"]);
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

test("a git worktree of the repository is not foreign, at the same commit or any other", () => {
  // hooks.json wires every hook to ${CLAUDE_PLUGIN_ROOT}/bin/mstack, which a
  // contributor cannot redirect per worktree, and the orchestrate playbook
  // makes worktrees the unit of parallel work. Round one's path-only rule
  // turned that session red every turn on byte-identical code; the rule now is
  // that foreign means outside the *repository*, told by the git common dir,
  // and green means the committed src tree also matches — the differing case
  // is the warning pinned by the sibling test below.
  const root = scratchCheckout();
  const wt = join(root, "..", `${root.split("/").pop()}-wt`);
  try {
    execFileSync("git", ["worktree", "add", "-q", "--detach", wt, "HEAD"], { cwd: root, stdio: "ignore" });

    // Same commit: the main checkout's copy reports on the worktree's store.
    const same = run(wt, join(root, "bin", "mstack"), ["gate"]);
    assert.equal(same.status, 0, `worktree at the same commit went red: ${same.stdout}${same.stderr}`);
    assert.match(same.stdout, /within the same repository at the same committed src tree/, same.stdout);
    assert.equal(same.stderr, "", `a note fired inside the repository: ${same.stderr}`);

    // A different commit whose src tree is unchanged: still the same
    // repository, still the same code, still the full [ok]. Pinned so that
    // "any other commit" means what it says for commits that do not touch
    // src/ — the ones that do are the sibling warning below.
    execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "worktree moved on"], { cwd: wt, stdio: "ignore" });
    const moved = run(wt, join(root, "bin", "mstack"), ["gate"]);
    assert.equal(moved.status, 0, `worktree at another commit went red: ${moved.stdout}${moved.stderr}`);
    assert.match(moved.stdout, /within the same repository at the same committed src tree/, moved.stdout);

    // And the store's own worktree copy agrees with itself, trivially.
    const own = run(wt, join(wt, "bin", "mstack"), ["gate"]);
    assert.equal(own.status, 0, own.stdout);
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: root, stdio: "ignore" });
    } catch {
      // The rm below sweeps whatever git left.
    }
    rmSync(wt, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("a separate clone stays foreign even at the same commit", () => {
  // The boundary the worktree rule must not erase: same bytes, same commit,
  // different repository. A clone is exactly the installed-cache shape with
  // git history attached, and it must keep failing.
  const root = scratchCheckout();
  const clone = join(root, "..", `${root.split("/").pop()}-clone`);
  try {
    execFileSync("git", ["clone", "-q", root, clone], { stdio: "ignore" });
    const gate = run(clone, join(root, "bin", "mstack"), ["gate"]);
    assert.equal(gate.status, 1, `a clone read as not-foreign: ${gate.stdout}`);
    assert.match(gate.stdout, /store's root is an mstack checkout/, gate.stdout);
  } finally {
    rmSync(clone, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("bin/mstack plus src/cli.ts without the mstack manifest is a user's repo: silent, exit 0", () => {
  // Round one fired here and told the user to run their own wrapper — the
  // command that had just produced the failure. The manifest is the identity;
  // an ordinary project that happens to carry both file markers gets silence.
  const root = scratchRepo();
  try {
    const setup = run(root, MSTACK, ["setup"]);
    assert.equal(setup.status, 0, setup.stderr);
    execFileSync("sh", ["-c", `mkdir -p bin src && printf '#!/bin/sh\\necho my own tool\\n' > bin/mstack && echo '// my project cli' > src/cli.ts`], {
      cwd: root,
      stdio: "ignore",
    });

    const gate = run(root, MSTACK, ["gate"]);
    assert.equal(gate.status, 0, `false positive: ${gate.stdout}`);
    assert.ok(!gate.stdout.includes("checkout"), `provenance fired without the manifest: ${gate.stdout}`);

    const list = run(root, MSTACK, ["state", "list"]);
    assert.equal(list.status, 0, list.stderr);
    assert.equal(list.stderr, "", `a note reached a wrapper repo: ${list.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a sibling at a different committed src tree is a named warning, not an ok and not a red gate", () => {
  // Round two accepted this case silently, with an affirmative [ok] — the
  // item's originating defect ("a gate change the cached copy does not
  // implement, reporting green") printed by the fix itself. Round three: same
  // repository stays necessary, and HEAD:src equality is the sufficiency
  // test. The severity is warn, not fail, and that is a recorded decision:
  // this is also the normal state for the life of any branch touching src/,
  // and a gate that is red every turn there is a hook people switch off.
  const root = scratchCheckout();
  const wt = join(root, "..", `${root.split("/").pop()}-wtdiff`);
  try {
    execFileSync("git", ["worktree", "add", "-q", "-b", "feat/new-check", wt, "HEAD"], { cwd: root, stdio: "ignore" });
    execFileSync("sh", ["-c", "printf '\\n// a change only this branch contains\\n' >> src/cli.ts && git add src/cli.ts && git commit -q -m 'diverge src'"], {
      cwd: wt,
      stdio: "ignore",
    });

    const gate = run(wt, join(root, "bin", "mstack"), ["gate"]);
    assert.equal(gate.status, 0, `the sibling warning became a red gate: ${gate.stdout}${gate.stderr}`);
    assert.match(gate.stdout, /\[warn\].*sibling of this repository at committed src tree [0-9a-f]{8}, not this store's [0-9a-f]{8}/, gate.stdout);
    assert.match(gate.stdout, /its checks may not be this store's checks/, gate.stdout);
    assert.ok(
      !gate.stdout.includes("at the same committed src tree"),
      `the affirmative ok printed over a genuine mismatch: ${gate.stdout}`,
    );

    // Non-gate commands say it on stderr, result unchanged.
    const list = run(wt, join(root, "bin", "mstack"), ["state", "list"]);
    assert.equal(list.status, 0, list.stderr);
    assert.match(
      list.stderr,
      /mstack: note: .*sibling copy from .* at committed src tree [0-9a-f]{8}, not this store.s [0-9a-f]{8}/,
      list.stderr,
    );

    // The worktree's own copy is still simply its own.
    const own = run(wt, join(wt, "bin", "mstack"), ["gate"]);
    assert.equal(own.status, 0, own.stdout);
    assert.match(own.stdout, /its own \.\/bin\/mstack/, own.stdout);
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: root, stdio: "ignore" });
    } catch {
      // The rm below sweeps whatever git left.
    }
    rmSync(wt, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("a fifo at the manifest path is silence, not a hang", () => {
  // The catch in isMstackCheckout turns throws into silence, but a blocking
  // read is not a throw: readFileSync on a fifo waits forever for a writer,
  // and this code runs on the Stop hook every turn and, via warnForeignCli,
  // on every subcommand. The spawn timeout below is the test's own guard —
  // against the pre-fix code the gate simply never returns and the child is
  // killed, which fails the exit-code assertion instead of hanging the suite.
  const root = scratchRepo();
  try {
    const setup = run(root, MSTACK, ["setup"]);
    assert.equal(setup.status, 0, setup.stderr);
    execFileSync("sh", ["-c", "mkdir -p bin src .claude-plugin && printf '#!/bin/sh\\n' > bin/mstack && echo '// cli' > src/cli.ts && mkfifo .claude-plugin/plugin.json"], {
      cwd: root,
      stdio: "ignore",
    });

    const gate = spawnSync(MSTACK, ["gate"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
      timeout: 10_000,
    });
    assert.equal(gate.signal, null, `the gate had to be killed: readFileSync blocked on the fifo`);
    assert.equal(gate.status, 0, `a fifo manifest broke the gate: ${gate.stdout}${gate.stderr}`);
    assert.ok(!gate.stdout.includes("checkout"), `a fifo manifest read as a checkout: ${gate.stdout}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("when the trees cannot be compared, both surfaces say so instead of claiming a difference", () => {
  // sameSrc is false both when the trees differ and when git gave no answer,
  // and round three's CLI note branched on the boolean alone — so it printed
  // "differs" over a comparison that never happened, while the gate on the
  // same state said "could not be compared". The clause is hoisted into
  // describeSrcComparison now precisely so the two surfaces cannot drift, and
  // this test pins the one branch of the switch that had none.
  const root = scratchCheckout();
  const wt = join(root, "..", `${root.split("/").pop()}-nosrc`);
  try {
    execFileSync("git", ["worktree", "add", "-q", "-b", "no-src-committed", wt, "HEAD"], { cwd: root, stdio: "ignore" });
    // src/ stays on disk (still a checkout) but leaves HEAD, so HEAD:src is
    // unresolvable on this side and the tree ids cannot be compared.
    execFileSync("sh", ["-c", "git rm -r -q --cached src && git commit -q -m 'src exists on disk, not in HEAD'"], {
      cwd: wt,
      stdio: "ignore",
    });

    const gate = run(wt, join(root, "bin", "mstack"), ["gate"]);
    assert.equal(gate.status, 0, `the uncomparable case became a red gate: ${gate.stdout}${gate.stderr}`);
    assert.match(gate.stdout, /\[warn\].*could not be compared \(git gave no answer\)/, gate.stdout);

    const list = run(wt, join(root, "bin", "mstack"), ["state", "list"]);
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stderr, /mstack: note: .*could not be compared \(git gave no answer\)/, list.stderr);
    assert.ok(
      !list.stderr.includes("at committed src tree") && !list.stderr.includes("differs"),
      `the note asserts a comparison that never happened: ${list.stderr}`,
    );
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: root, stdio: "ignore" });
    } catch {
      // The rm below sweeps whatever git left.
    }
    rmSync(wt, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("uncommitted src edits are invisible to the committed-tree comparison, as decided", () => {
  // The limit is stated in paths.ts, gate.ts and Gates-and-Hooks, and this is
  // the test that keeps it a decision rather than prose: a worktree carrying
  // an *uncommitted* src/ edit observably runs that edit under its own CLI,
  // and still gets the full [ok] from a sibling, because HEAD:src is the
  // committed tree on both sides. The adjacent "uncommitted change(s)"
  // warning is what puts the missing fact one line away. If tightening the
  // comparison to see the working tree is ever wanted, this test is the one
  // to change — deliberately.
  const root = scratchCheckout();
  const wt = join(root, "..", `${root.split("/").pop()}-dirty`);
  try {
    execFileSync("git", ["worktree", "add", "-q", "--detach", wt, "HEAD"], { cwd: root, stdio: "ignore" });
    // An uncommitted divergence the worktree's own CLI observably runs: cli.ts
    // is the entry module and there is no build step, so a top-level line
    // appended to it executes on every invocation of that copy — the marker on
    // stderr below is the branch's own working tree speaking...
    execFileSync("sh", ["-c", `printf '\\nconsole.error("UNCOMMITTED-ONLY-IN-WORKING-TREE");\\n' >> src/cli.ts`], {
      cwd: wt,
      stdio: "ignore",
    });
    const own = run(wt, join(wt, "bin", "mstack"), ["gate"]);
    assert.equal(own.status, 0, own.stdout);
    assert.match(own.stderr, /UNCOMMITTED-ONLY-IN-WORKING-TREE/, "the worktree's own copy runs the edited tree");

    // ...while a sibling still reports the full agreeing [ok], exit 0, and
    // never sees the divergence, because HEAD:src is the committed tree.
    const sibling = run(wt, join(root, "bin", "mstack"), ["gate"]);
    assert.equal(sibling.status, 0, `the limit tightened: ${sibling.stdout}${sibling.stderr}`);
    assert.match(sibling.stdout, /within the same repository at the same committed src tree/, sibling.stdout);
    assert.match(sibling.stdout, /uncommitted change/, "the adjacent warning that carries the missing fact");
    const list = run(wt, join(root, "bin", "mstack"), ["state", "list"]);
    assert.equal(list.stderr, "", `a note fired on a same-committed-tree sibling: ${list.stderr}`);
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: root, stdio: "ignore" });
    } catch {
      // The rm below sweeps whatever git left.
    }
    rmSync(wt, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});
