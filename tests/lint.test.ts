import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lintPlugin } from "../src/lint.ts";
import { STATUSES } from "../src/lifecycle.ts";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A copy of the real plugin, so each test breaks one thing on purpose. */
function copy(): { root: string; dispose(): void } {
  const root = mkdtempSync(join(tmpdir(), "mstack-lint-"));
  for (const dir of ["skills", "agents", "hooks", ".claude-plugin", "src", "licenses"]) {
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

test("a plugin-root CLAUDE.md warns, because a consumer never loads it", () => {
  const c = copy();
  try {
    writeFileSync(join(c.root, "CLAUDE.md"), "# memo\n");
    const report = lint(c.root);
    assert.equal(report.failed, false, "a warning, not a failure");
    assert.ok(
      report.warnings.some((w) => /plugin-root CLAUDE\.md/.test(w)),
      `expected the CLAUDE.md warning, got ${JSON.stringify(report.warnings)}`,
    );
  } finally {
    c.dispose();
  }
});

test("a plugin-root CLAUDE.md is not a warning where .mstack/ shows the repo is worked in", () => {
  // The self-hosting case: the setup skill tells the project to carry a
  // CLAUDE.md, and this plugin's own repo is its own project.
  const c = copy();
  try {
    writeFileSync(join(c.root, "CLAUDE.md"), "# memo\n");
    mkdirSync(join(c.root, ".mstack"));
    const report = lint(c.root);
    assert.equal(report.failed, false);
    assert.ok(
      !report.warnings.some((w) => /CLAUDE\.md/.test(w)),
      `expected no CLAUDE.md warning, got ${JSON.stringify(report.warnings)}`,
    );
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

test("a hooks.json entry whose argument names an event the CLI does not handle is refused", () => {
  const c = copy();
  try {
    const file = join(c.root, "hooks", "hooks.json");
    const before = readFileSync(file, "utf8");
    assert.ok(before.includes('"session-start"'), "the fixture still names session-start");
    writeFileSync(file, before.replace('"session-start"', '"sesion-start"'));
    expectFail(c.root, /'SessionStart'.*mstack hook sesion-start.*does not handle/, "misspelt hook argument");
    const report = lint(c.root);
    assert.ok(
      report.failures.some((f) => /did you mean 'session-start'/.test(f)),
      `names the nearest handled event: ${JSON.stringify(report.failures)}`,
    );
  } finally {
    c.dispose();
  }
});

test("the real hooks.json passes the argument check", () => {
  const c = copy();
  try {
    const report = lint(c.root);
    assert.deepEqual(
      report.failures.filter((f) => /mstack hook/.test(f)),
      [],
    );
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

test("an origin header that names a licence file the plugin does not ship is caught", () => {
  const c = copy();
  try {
    rmSync(join(c.root, "licenses", "obra-superpowers-LICENSE.txt"));
    expectFail(c.root, /intake\.md.*licenses\/obra-superpowers-LICENSE\.txt.*does not exist/, "missing licence");
  } finally {
    c.dispose();
  }
});

test("an origin header outside the required list that names a missing licence is caught", () => {
  for (const rel of [
    ["skills", "review", "SKILL.md"],
    ["agents", "reviewer.md"],
  ]) {
    const c = copy();
    try {
      const file = join(c.root, ...rel);
      writeFileSync(file, `${readFileSync(file, "utf8")}\n<!-- Origin: x/y @ abc (MIT, licenses/no-such-LICENSE.txt) -->\n`);
      expectFail(c.root, /licenses\/no-such-LICENSE\.txt.*does not exist/, `header in ${rel.join("/")}`);
    } finally {
      c.dispose();
    }
  }
});

test("an origin header that names no licence file is caught", () => {
  const c = copy();
  try {
    const file = join(c.root, "skills", "test-first", "SKILL.md");
    writeFileSync(file, readFileSync(file, "utf8").replace(/licenses\/[A-Za-z0-9._-]+/g, "somewhere"));
    expectFail(c.root, /test-first\/SKILL\.md.*names no file under licenses\//, "header without a licence");
  } finally {
    c.dispose();
  }
});

test("a file that must carry an origin header and does not is caught", () => {
  for (const rel of [
    "skills/router/references/intake.md",
    "skills/test-first/SKILL.md",
    "skills/design/references/deep-modules.md",
    "skills/router/playbooks/deepen.md",
    "skills/router/playbooks/bug-fix.md",
    "skills/reflect/references/domain-docs.md",
    "skills/verify/SKILL.md",
    "skills/router/references/evidence-ladder.md",
    "agents/implementer.md",
    "skills/spec/SKILL.md",
    "skills/router/playbooks/orchestrate.md",
  ]) {
    const c = copy();
    try {
      const file = join(c.root, rel);
      writeFileSync(file, readFileSync(file, "utf8").replace(/^<!-- Origin:.*-->\n/m, ""));
      expectFail(c.root, new RegExp(`${rel}.*no origin header`), `header removed from ${rel}`);
    } finally {
      c.dispose();
    }
  }
});

test("a router whose orient steps no longer link intake.md is caught", () => {
  const c = copy();
  try {
    const file = join(c.root, "skills", "router", "SKILL.md");
    const before = readFileSync(file, "utf8");
    const start = before.indexOf("3. **Intake**");
    const end = before.indexOf("4. Match the request");
    assert.ok(start > 0 && end > start, "the fixture still has the intake step");
    writeFileSync(file, `${before.slice(0, start)}${before.slice(end)}`);
    assert.ok(before.includes("references/intake.md](references/intake.md) defines"), "intake.md is still linked elsewhere in the router");
    expectFail(c.root, /router\/SKILL\.md.*orient.*references\/intake\.md/, "intake step removed");
  } finally {
    c.dispose();
  }
});

test("a plugin with no router is not held to the router rule", () => {
  const c = copy();
  try {
    rmSync(join(c.root, "skills", "router"), { recursive: true });
    const report = lint(c.root);
    assert.ok(!report.failures.some((f) => /intake/.test(f)), JSON.stringify(report.failures));
  } finally {
    c.dispose();
  }
});

function setAgentSkills(root: string, entries: string[]): void {
  const file = join(root, "agents", "implementer.md");
  const source = readFileSync(file, "utf8");
  assert.ok(/^skills:\n  - test-first\n/m.test(source), "the fixture still preloads test-first");
  writeFileSync(file, source.replace(/^skills:\n  - test-first\n/m, `skills: [${entries.join(", ")}]\n`));
}

test("an agent whose skills entry names no skill under skills/ is caught", () => {
  const c = copy();
  try {
    setAgentSkills(c.root, ["test-frist"]);
    expectFail(c.root, /implementer\.md.*'test-frist'.*no skill/, "misspelt preloaded skill");
  } finally {
    c.dispose();
  }
});

test("an agent that preloads a skill with disable-model-invocation: true is caught", () => {
  const c = copy();
  try {
    const file = join(c.root, "skills", "test-first", "SKILL.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("user-invocable: false\n", "user-invocable: false\ndisable-model-invocation: true\n"));
    expectFail(c.root, /implementer\.md.*'test-first'.*disable-model-invocation/, "hidden preloaded skill");
  } finally {
    c.dispose();
  }
});

test("a skills entry that resolves, or that names another plugin's skill, passes", () => {
  const c = copy();
  try {
    setAgentSkills(c.root, ["mstack:test-first", "someone-else:their-skill"]);
    const report = lint(c.root);
    assert.deepEqual(report.failures.filter((f) => /skills/.test(f) && /implementer/.test(f)), []);
  } finally {
    c.dispose();
  }
});

test("an agent with no skills field is not held to the skills rule", () => {
  const c = copy();
  try {
    const file = join(c.root, "agents", "implementer.md");
    writeFileSync(file, readFileSync(file, "utf8").replace(/^skills:\n  - test-first\n/m, ""));
    assert.equal(lint(c.root).failed, false, JSON.stringify(lint(c.root).failures));
  } finally {
    c.dispose();
  }
});

test("a skills entry namespaced to this plugin is resolved, so a misspelt one is caught", () => {
  const c = copy();
  try {
    setAgentSkills(c.root, ["mstack:test-frist"]);
    expectFail(c.root, /implementer\.md.*'mstack:test-frist'.*no skill/, "misspelt namespaced skill");
  } finally {
    c.dispose();
  }
});
