import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lintPlugin } from "../src/lint.ts";
import { STATUSES } from "../src/lifecycle.ts";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A copy of the real plugin, so each test breaks one thing on purpose. */
function copy(): { root: string; dispose(): void } {
  const root = mkdtempSync(join(tmpdir(), "mstack-lint-"));
  for (const dir of ["skills", "agents", "hooks", ".claude-plugin", "src"]) {
    cpSync(join(PLUGIN, dir), join(root, dir), { recursive: true });
  }
  return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

function lint(root: string) {
  const quiet = console.log;
  console.log = () => {};
  try {
    return lintPlugin(root);
  } finally {
    console.log = quiet;
  }
}

function expectFail(root: string, matcher: RegExp, label: string): void {
  const report = lint(root);
  assert.ok(report.failed, `${label}: expected a failure, got a pass`);
  assert.ok(
    report.failures.some((f) => matcher.test(f)),
    `${label}: failed silently. Nothing matched ${matcher}. Got ${JSON.stringify(report.failures)}`,
  );
}

test("the plugin as shipped lints clean", () => {
  const c = copy();
  try {
    assert.equal(lint(c.root).failed, false);
  } finally {
    c.dispose();
  }
});

test("a reference to an agent that does not exist is caught", () => {
  // pstack forbids the built-in babysit skill by name in one file while two of
  // its own files tell you to run it. Nothing there could notice.
  const c = copy();
  try {
    const file = join(c.root, "skills", "review", "SKILL.md");
    writeFileSync(file, `${readFileSync(file, "utf8")}\n\nDelegate to \`mstack:security-guardian\`.\n`);
    expectFail(c.root, /mstack:security-guardian/, "dangling agent reference");
  } finally {
    c.dispose();
  }
});

test("a broken relative link is caught", () => {
  const c = copy();
  try {
    const file = join(c.root, "skills", "router", "SKILL.md");
    writeFileSync(file, `${readFileSync(file, "utf8")}\n\n[gone](playbooks/deleted.md)\n`);
    expectFail(c.root, /broken link/, "broken link");
  } finally {
    c.dispose();
  }
});

test("an over-long description is caught, because the listing truncates it", () => {
  const c = copy();
  try {
    const file = join(c.root, "skills", "verify", "SKILL.md");
    writeFileSync(file, readFileSync(file, "utf8").replace(/^description: .*$/m, `description: ${"x".repeat(1600)}`));
    expectFail(c.root, /over the 1,?536 cap/, "long description");
  } finally {
    c.dispose();
  }
});

test("front matter a plugin agent silently drops is caught", () => {
  const c = copy();
  try {
    const file = join(c.root, "agents", "reviewer.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("color: orange", "permissionMode: bypassPermissions"));
    expectFail(c.root, /silently dropped from plugin-shipped agents/, "unsupported agent key");
  } finally {
    c.dispose();
  }
});

test("a miscased hook event is caught, since event names are case-sensitive", () => {
  const c = copy();
  try {
    const file = join(c.root, "hooks", "hooks.json");
    writeFileSync(file, readFileSync(file, "utf8").replace('"SubagentStop"', '"subagentStop"'));
    expectFail(c.root, /did you mean 'SubagentStop'/, "miscased event");
  } finally {
    c.dispose();
  }
});

test("a second copy of the lifecycle enum is caught", () => {
  const c = copy();
  try {
    // Built from the real enum rather than typed out. A hardcoded copy here
    // would be the exact defect this test exists to detect, and it would stop
    // detecting anything the moment a status was added.
    writeFileSync(join(c.root, "skills", "duplicate.md"), `${STATUSES.join(" ")}\n`);
    expectFail(c.root, /lifecycle enum is repeated/, "duplicated enum");
  } finally {
    c.dispose();
  }
});

test("a component directory misplaced inside .claude-plugin is caught", () => {
  const c = copy();
  try {
    cpSync(join(c.root, "agents"), join(c.root, ".claude-plugin", "agents"), { recursive: true });
    expectFail(c.root, /inside \.claude-plugin/, "misplaced directory");
  } finally {
    c.dispose();
  }
});

test("a broken link in a reference file is caught, not just in a SKILL.md", () => {
  const c = copy();
  try {
    // Links were validated in skills and agents and nowhere else, which left
    // the playbooks and references unchecked. That is more than half the prose,
    // and it is the exact defect this plugin was written in response to.
    const target = join(c.root, "skills", "router", "references", "evidence-ladder.md");
    writeFileSync(target, `${readFileSync(target, "utf8")}\n\nSee [nothing](./no-such-file.md).\n`);
    expectFail(c.root, /evidence-ladder\.md: broken link to \.\/no-such-file\.md/, "reference link");
  } finally {
    c.dispose();
  }
});

test("a broken link in a playbook is caught too", () => {
  const c = copy();
  try {
    const target = join(c.root, "skills", "router", "playbooks", "feature.md");
    writeFileSync(target, `${readFileSync(target, "utf8")}\n\n[gone](../references/gone.md)\n`);
    expectFail(c.root, /feature\.md: broken link to \.\.\/references\/gone\.md/, "playbook link");
  } finally {
    c.dispose();
  }
});

test("a shipped command with no path is caught, because it hangs the agent that runs it", () => {
  const c = copy();
  try {
    // `rg PATTERN --glob '*.md'` with no path takes ripgrep's stdin form and
    // blocks forever when stdin is not a terminal, which is how every subagent
    // runs a command. One shipped in the playbook whose job is to *start* an
    // investigation, and only a reviewer running it found out.
    const target = join(c.root, "skills", "router", "playbooks", "investigate.md");
    writeFileSync(target, `${readFileSync(target, "utf8")}\n\`\`\`bash\nrg -l -i 'adr' --glob '*.md'\n\`\`\`\n`);
    expectFail(c.root, /has no path, so it reads stdin and hangs/, "stdin form");
  } finally {
    c.dispose();
  }
});

test("the same command with a path is left alone", () => {
  const c = copy();
  try {
    const target = join(c.root, "skills", "router", "playbooks", "investigate.md");
    writeFileSync(
      target,
      `${readFileSync(target, "utf8")}\n\`\`\`bash\nrg -l -i 'adr' --glob '*.md' .\nrg -n 'TODO' <file>\nrg -c 'x' src/\n\`\`\`\n`,
    );
    assert.equal(lint(c.root).failed, false, JSON.stringify(lint(c.root).failures));
  } finally {
    c.dispose();
  }
});
