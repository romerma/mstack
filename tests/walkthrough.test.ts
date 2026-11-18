import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Item 96: the docs/wiki/Getting-Started.md walkthrough, command by command, through the real CLI.
 *
 * Every step is one command of the page, in the page's order, in a throwaway git repository. A
 * closing check added later that the page's sequence does not satisfy fails here before a reader
 * meets it. The page's verification command is `python3 -m unittest test_greet -v`, so the test
 * needs python3 and says so when it is missing.
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");
const FLAGS = process.execPath.endsWith("bun") ? [] : ["--disable-warning=ExperimentalWarning", "--experimental-strip-types"];
const ENV = { ...process.env, HOME: "", GIT_CONFIG_GLOBAL: "/dev/null", PYTHONDONTWRITEBYTECODE: "1" };
const VERIFICATION = "python3 -m unittest test_greet -v";

const hasPython = spawnSync("python3", ["--version"], { encoding: "utf8", timeout: 10_000 }).status === 0;

type Result = { out: string; code: number };

function run(cwd: string, cmd: string, args: string[]): Result {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 30_000, env: ENV });
  if (r.error !== undefined) throw r.error;
  return { out: `${r.stdout ?? ""}${r.stderr ?? ""}`, code: r.status ?? 1 };
}

const GREET_PY_0 = `import sys


def greet(name):
    return f"Hello, {name}"


if __name__ == "__main__":
    print(greet(sys.argv[1]))
`;
const TEST_PY_0 = `import unittest
from greet import greet


class TestGreet(unittest.TestCase):
    def test_default(self):
        self.assertEqual(greet("world"), "Hello, world")
`;
const GREET_PY = `import sys


def greet(name, shout=False):
    text = f"Hello, {name}"
    return text.upper() if shout else text


if __name__ == "__main__":
    args = sys.argv[1:]
    print(greet([a for a in args if a != "--shout"][0], "--shout" in args))
`;
const TEST_PY = `${TEST_PY_0}
    def test_shout(self):
        self.assertEqual(greet("world", shout=True), "HELLO, WORLD")
`;
const REPORT = `# greet-flag: implementation report

## What changed

\`greet.py\` takes \`--shout\`; \`test_greet.py\` covers the flag and the default.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | test_shout | test_greet.py:9 |
| A2 | test_default, test_shout | test_greet.py:6, test_greet.py:9 |
`;

/** The page's sequence. A mutant leaves out the report or the verification run to see the close refuse. */
function walkthrough(root: string, leaveOut: { report?: boolean; gateFull?: boolean } = {}): { closeOut: string; closeCode: number } {
  const mstack = (...args: string[]): Result => run(root, process.execPath, [...FLAGS, CLI, ...args]);
  const git = (...args: string[]): Result => run(root, "git", args);
  const step = (what: string, r: Result, code: number): Result => {
    assert.equal(r.code, code, `${what}: exit ${r.code}, wanted ${code}\n${r.out}`);
    return r;
  };

  // the scratch repository the page starts from: greet.py and test_greet.py, one commit
  step("git init", git("init", "-q"), 0);
  step("git head", git("symbolic-ref", "HEAD", "refs/heads/main"), 0);
  step("git user.name", git("config", "user.name", "demo"), 0);
  step("git user.email", git("config", "user.email", "demo@example.com"), 0);
  writeFileSync(join(root, "greet.py"), GREET_PY_0);
  writeFileSync(join(root, "test_greet.py"), TEST_PY_0);
  step("git add", git("add", "-A"), 0);
  step("git commit", git("commit", "-q", "-m", "init"), 0);

  // Getting-Started, "Create the store"
  step("mstack setup", mstack("setup"), 0);
  step("mstack gate (two warnings)", mstack("gate"), 0);
  assert.match(mstack("gate").out, /PASSED - 0 failures, 2 warnings/);
  step("git add the store", git("add", "-A"), 0);
  step("git commit the store", git("commit", "-q", "-m", "chore: add the mstack store"), 0);

  // "Add it and open it"
  step(
    "state add",
    mstack(
      "state", "add", "--slug", "greet-flag", "--title", "greet --shout uppercases the greeting",
      "--acceptance", "`python3 greet.py --shout world` prints HELLO, WORLD",
      "--acceptance", "test_greet.py covers the flag and the default",
      "--verification", VERIFICATION, "--source", "direct request",
    ),
    0,
  );
  step("git switch", git("switch", "-c", "feat/greet-flag"), 0);
  const open = step("state set in_progress", mstack("state", "set", "greet-flag", "--status", "in_progress"), 0);
  assert.match(open.out, /base: \(unset\) -> "[0-9a-f]{40}"/);

  // "The gate holds you to the checkpoint discipline"
  const red = step("gate with current.md untouched", mstack("gate"), 1);
  assert.match(red.out, /\[fail\] {2}1 greet-flag \(in_progress\) is active but progress\/current\.md is not/);
  writeFileSync(
    join(root, ".mstack", "progress", "current.md"),
    "# Current session\n\n- **Item:** greet-flag, the --shout flag\n\n## Next step\n\nadd the flag and its test, then verify\n",
  );

  // "Do the work and verify it"
  writeFileSync(join(root, "greet.py"), GREET_PY);
  writeFileSync(join(root, "test_greet.py"), TEST_PY);
  assert.equal(step("greet.py --shout world", run(root, "python3", ["greet.py", "--shout", "world"]), 0).out, "HELLO, WORLD\n");
  assert.match(step("unittest", run(root, "python3", ["-m", "unittest", "test_greet", "-v"]), 0).out, /Ran 2 tests/);
  if (leaveOut.report !== true) writeFileSync(join(root, ".mstack", "progress", "impl_greet-flag.md"), REPORT);
  step("git add the work", git("add", "-A"), 0);
  step("git commit the work", git("commit", "-q", "-m", "feat: greet --shout uppercases the greeting"), 0);
  const head = git("rev-parse", "HEAD").out.trim();
  step(
    "ledger record implementer",
    mstack("ledger", "record", "greet-flag", head, "test-verified", "--evidence", ".mstack/progress/impl_greet-flag.md: python3 -m unittest test_greet -v, 2 tests, OK", "--verifier", "implementer"),
    0,
  );

  // "The lifecycle refuses the shortcut"
  const shortcut = step("state set done from in_progress", mstack("state", "set", "greet-flag", "--status", "done"), 2);
  assert.match(shortcut.out, /mstack: in_progress -> done is not a legal transition/);
  step("state set reviewing", mstack("state", "set", "greet-flag", "--status", "reviewing"), 0);
  step("state set verifying", mstack("state", "set", "greet-flag", "--status", "verifying"), 0);

  // "The close is audited, and the author's word is not enough": the refusal on the implementer's row alone
  const authorOnly = step("close on the implementer's row", mstack("state", "set", "greet-flag", "--status", "done", "--closed-by", "demo walkthrough"), 2);
  assert.match(authorOnly.out, /mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code \(only implementer\)/);

  // the reviewer: gate --full runs the verification (red for the missing second row only), then its own row
  if (leaveOut.gateFull !== true) {
    const full = step("gate --full", mstack("gate", "--full"), 1);
    assert.match(full.out, /\[fail\] {2}1 greet-flag \(verifying\) is one step from done, and its only verdicts are from the pass that wrote the code/);
    assert.match(full.out, /\[ok\] {4}python3 -m unittest test_greet -v/);
    if (leaveOut.report !== true) assert.match(full.out, /FAILED - 1 failure, 1 warning/);
  }
  step(
    "ledger record reviewer",
    mstack("ledger", "record", "greet-flag", head, "test-verified", "--evidence", "reviewer ran mstack gate --full: python3 -m unittest test_greet -v, 2 tests, OK; diff read against both acceptance bullets", "--verifier", "reviewer"),
    0,
  );
  const close = mstack("state", "set", "greet-flag", "--status", "done", "--closed-by", "demo walkthrough");
  if (close.code !== 0) return { closeOut: close.out, closeCode: close.code };
  assert.match(close.out, /1 greet-flag \(done\)/);
  assert.match(close.out, /status: "verifying" -> "done"/);
  assert.match(close.out, /closed_by: \(unset\) -> "demo walkthrough"/);
  const gate = step("gate after the close", mstack("gate"), 0);
  assert.match(gate.out, /\[ok\] {4}1 closed item\(s\) carry a ledger verdict/);
  assert.match(gate.out, /PASSED - 0 failures, 1 warning/);

  // "What a new commit does to that verdict"
  step("git add the close", git("add", "-A"), 0);
  step("git commit the close", git("commit", "-q", "-m", "chore: close greet-flag"), 0);
  writeFileSync(join(root, "README.md"), "# demo\n");
  step("git add readme", git("add", "-A"), 0);
  step("git commit readme", git("commit", "-q", "-m", "docs: add a readme"), 0);
  const stale = step("ledger check", mstack("ledger", "check", "greet-flag"), 1);
  assert.match(stale.out, /FAIL no verdict at [0-9a-f]{8}; 2 row\(s\) exist at other SHAs and a new head SHA voids them/);
  return { closeOut: close.out, closeCode: 0 };
}

function inThrowawayRepo<T>(fn: (root: string) => T): T {
  const base = mkdtempSync(join(tmpdir(), "mstack-walkthrough-"));
  const root = join(base, "repo");
  mkdirSync(root);
  try {
    return fn(root);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

// bun ignores the `skip` option of node:test, so choose the function instead; the reason rides in the name
const SKIPPED = hasPython ? "" : " [skipped: python3 is not on PATH, and the page's verification command is python3 -m unittest]";
const walk = hasPython ? test : test.skip;

walk(`Getting-Started, every command in order, ends in the accepted close and a green gate${SKIPPED}`, { timeout: 180_000 }, () => {
  const r = inThrowawayRepo((root) => walkthrough(root));
  assert.equal(r.closeCode, 0, r.closeOut);
});

walk(`Getting-Started without the implementation report is refused at the close${SKIPPED}`, { timeout: 180_000 }, () => {
  const r = inThrowawayRepo((root) => walkthrough(root, { report: true }));
  assert.equal(r.closeCode, 2);
  assert.match(r.closeOut, /it has no implementation report to read, \.mstack\/progress\/impl_greet-flag\.md/);
});

walk(`Getting-Started without gate --full is refused at the close${SKIPPED}`, { timeout: 180_000 }, () => {
  const r = inThrowawayRepo((root) => walkthrough(root, { gateFull: true }));
  assert.equal(r.closeCode, 2);
  assert.match(r.closeOut, /`python3 -m unittest test_greet -v` has never been executed/);
});
