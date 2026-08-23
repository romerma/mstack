import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import { parse } from "./frontmatter.ts";
import { STATUSES } from "./lifecycle.ts";
import { Report } from "./report.ts";

/**
 * Validate the prose.
 *
 * pstack ships 125 Markdown files and four test files, all four covering its
 * two TypeScript CLIs. Ninety-eight percent of its behaviour has no validation
 * at all, its own authoring guide asks for a checker, and its own reflect skill
 * says to skip that step if the environment does not ship one. This is that
 * checker.
 */

/** Front-matter keys Claude Code accepts on a skill. */
const SKILL_KEYS = new Set([
  "name",
  "description",
  "when_to_use",
  "argument-hint",
  "arguments",
  "disable-model-invocation",
  "user-invocable",
  "allowed-tools",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "agent",
  "background",
  "hooks",
  "paths",
  "shell",
  "metadata",
  "license",
  "compatibility",
]);

/** Front-matter keys a *plugin-shipped* agent may carry. */
const AGENT_KEYS = new Set([
  "name",
  "description",
  "model",
  "effort",
  "maxTurns",
  "tools",
  "disallowedTools",
  "skills",
  "memory",
  "background",
  "isolation",
  "color",
]);

/** Silently dropped from plugin agents, so carrying them is a lie about behaviour. */
const AGENT_FORBIDDEN = new Set(["hooks", "mcpServers", "permissionMode"]);

const HOOK_EVENTS = new Set([
  "SessionStart",
  "Setup",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "PreToolUse",
  "PermissionRequest",
  "PermissionDenied",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "MessageDisplay",
  "SubagentStart",
  "SubagentStop",
  "TaskCreated",
  "TaskCompleted",
  "Stop",
  "StopFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "FileChanged",
  "ConfigChange",
  "CwdChanged",
  "DirectoryAdded",
  "WorktreeCreate",
  "WorktreeRemove",
  "InstructionsLoaded",
  "TeammateIdle",
  "Elicitation",
  "ElicitationResult",
]);

/** The listing truncates description + when_to_use past this many characters. */
const DESCRIPTION_CAP = 1_536;
/** Guidance, not an enforced limit, but a router over this is a router nobody reads. */
const SKILL_LINE_CAP = 500;

export function lintPlugin(root: string): Report {
  const report = new Report();
  const dir = resolve(root);

  report.section("manifest");
  lintManifest(dir, report);

  report.section("skills");
  const skills = collect(join(dir, "skills"), "SKILL.md");
  if (skills.length === 0) report.warn("no skills found");
  for (const file of skills) lintSkill(dir, file, report);

  report.section("agents");
  const agents = existsSync(join(dir, "agents"))
    ? readdirSync(join(dir, "agents")).filter((f) => extname(f) === ".md").map((f) => join(dir, "agents", f))
    : [];
  if (agents.length === 0) report.warn("no agents found");
  for (const file of agents) lintAgent(dir, file, report);

  report.section("hooks");
  lintHooks(dir, report);

  report.section("references");
  lintReferenceFiles(dir, report);

  report.section("shipped commands");
  lintCommands(dir, report);

  report.section("cross-references");
  lintReferences(dir, skills, agents, report);

  report.section("single source of truth");
  lintLifecycleDuplication(dir, report);

  report.summary();
  return report;
}

function lintManifest(dir: string, report: Report): void {
  const manifest = join(dir, ".claude-plugin", "plugin.json");
  if (!existsSync(manifest)) {
    report.fail("missing .claude-plugin/plugin.json");
    return;
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(manifest, "utf8")) as Record<string, unknown>;
  } catch (error) {
    report.fail(`plugin.json is not valid JSON: ${(error as Error).message}`);
    return;
  }
  if (typeof data["name"] !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data["name"])) {
    report.fail("plugin.json .name must be kebab-case");
  } else {
    report.ok(`plugin name: ${data["name"]}`);
  }
  for (const dirName of ["skills", "agents", "hooks", "commands"]) {
    if (existsSync(join(dir, ".claude-plugin", dirName))) {
      report.fail(
        `${dirName}/ is inside .claude-plugin/`,
        "only plugin.json belongs there; every component directory sits at the plugin root",
      );
    }
  }
  if (existsSync(join(dir, "CLAUDE.md"))) {
    // A consumer's Claude Code never loads a plugin-root CLAUDE.md. But a repo
    // carrying its own .mstack/ store is also a worked-in project, and there
    // the file is ordinary project memory that a fresh session does load.
    if (existsSync(join(dir, ".mstack"))) {
      report.ok("plugin-root CLAUDE.md is project memory for this checkout; .mstack/ shows the repo is worked in");
    } else {
      report.warn("a plugin-root CLAUDE.md is not loaded as context; ship instructions as a skill instead");
    }
  }
}

function lintSkill(root: string, file: string, report: Report): void {
  const label = relative(root, file);
  const source = readFileSync(file, "utf8");
  const { data, error } = parse(source);

  if (error !== null) {
    report.fail(`${label}: ${error}`, "malformed front matter loads the body with no description to match on");
    return;
  }
  for (const key of Object.keys(data)) {
    if (!SKILL_KEYS.has(key)) report.fail(`${label}: unknown front-matter key '${key}'`);
  }
  const description = String(data["description"] ?? "");
  if (description === "") {
    report.fail(`${label}: no description`, "without one Claude has nothing to match the skill against");
  }
  const combined = description.length + String(data["when_to_use"] ?? "").length;
  if (combined > DESCRIPTION_CAP) {
    report.fail(
      `${label}: description + when_to_use is ${combined} characters, over the ${DESCRIPTION_CAP} cap`,
      "the listing truncates past that, so put the key use case first",
    );
  }
  const lines = source.split("\n").length;
  if (lines > SKILL_LINE_CAP) {
    report.fail(`${label}: ${lines} lines, over the ${SKILL_LINE_CAP}-line guidance`, "move detail into references/");
  }
  lintLinks(root, file, source, report);
  if (!report.failed) report.ok(`${label} (${lines} lines, ${combined} description chars)`);
}

function lintAgent(root: string, file: string, report: Report): void {
  const label = relative(root, file);
  const source = readFileSync(file, "utf8");
  const { data, error } = parse(source);

  if (error !== null) {
    report.fail(`${label}: ${error}`);
    return;
  }
  const name = String(data["name"] ?? "");
  if (name === "") report.fail(`${label}: no name`);
  else if (name.includes(":")) {
    report.fail(`${label}: name contains ':'`, "that character is reserved for plugin scoping and refuses to load");
  }
  if (String(data["description"] ?? "") === "") report.fail(`${label}: no description`);

  for (const key of Object.keys(data)) {
    if (AGENT_FORBIDDEN.has(key)) {
      report.fail(
        `${label}: '${key}' is silently dropped from plugin-shipped agents`,
        "put it in hooks/hooks.json or a skill instead, and do not imply behaviour that never runs",
      );
    } else if (!AGENT_KEYS.has(key)) {
      report.fail(`${label}: unknown front-matter key '${key}'`);
    }
  }
  lintLinks(root, file, source, report);
  if (!report.failed) report.ok(label);
}

function lintHooks(root: string, report: Report): void {
  const file = join(root, "hooks", "hooks.json");
  if (!existsSync(file)) {
    report.warn("no hooks/hooks.json; every rule in this plugin is then advisory");
    return;
  }
  let data: { hooks?: Record<string, unknown> };
  try {
    data = JSON.parse(readFileSync(file, "utf8")) as { hooks?: Record<string, unknown> };
  } catch (error) {
    report.fail(`hooks.json is not valid JSON: ${(error as Error).message}`);
    return;
  }
  const events = Object.keys(data.hooks ?? {});
  if (events.length === 0) report.warn("hooks.json declares no events");
  for (const event of events) {
    if (HOOK_EVENTS.has(event)) {
      report.ok(`hook event ${event}`);
      continue;
    }
    const near = [...HOOK_EVENTS].find((e) => e.toLowerCase() === event.toLowerCase());
    report.fail(
      `hooks.json: '${event}' is not a hook event`,
      near !== undefined ? `event names are case-sensitive; did you mean '${near}'?` : "check the hooks reference",
    );
  }
}

/**
 * Every `mstack:<name>` reference resolves to a skill or an agent that exists.
 *
 * This is the drift class that catches prose workflows. pstack's mode skill
 * forbids the built-in babysit skill by name while two of its own files
 * instruct you to run it, and nothing in that repository could notice. A
 * reference to a role that was renamed reads exactly like a working one.
 */
function lintReferences(
  root: string,
  skillFiles: readonly string[],
  agentFiles: readonly string[],
  report: Report,
): void {
  const known = new Set<string>();
  for (const file of skillFiles) known.add(nameOf(file) ?? basename(dirname(file)));
  for (const file of agentFiles) known.add(nameOf(file) ?? basename(file, ".md"));

  // Playbooks and references are where these names are actually written — the
  // router's route table names a skill on nearly every line. Scanning only
  // SKILL.md and agents left that unchecked, which is the same scope bug the
  // link check had, fixed only for links.
  const prose = [
    ...new Set([
      ...skillFiles,
      ...agentFiles,
      ...collectAll(join(root, "skills")).filter((file) => extname(file) === ".md"),
    ]),
  ];

  const dangling = new Map<string, string[]>();
  for (const file of prose) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bmstack:([a-z][a-z0-9-]*)/g)) {
      const name = match[1] ?? "";
      if (known.has(name)) continue;
      const where = dangling.get(name) ?? [];
      where.push(relative(root, file));
      dangling.set(name, where);
    }
  }
  if (dangling.size === 0) {
    report.ok(`${known.size} skills and agents, every cross-reference in ${prose.length} file(s) resolves`);
    return;
  }
  for (const [name, files] of dangling) {
    report.fail(
      `mstack:${name} is referenced in ${[...new Set(files)].join(", ")} but no such skill or agent exists`,
      "rename the reference, or ship the thing it names",
    );
  }
}

function nameOf(file: string): string | null {
  const value = parse(readFileSync(file, "utf8")).data["name"];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The lifecycle enum lives in exactly one file. enxvo carries its copy in six,
 * which is six chances for them to drift apart with nothing to notice.
 */
function lintLifecycleDuplication(root: string, report: Report): void {
  const needles = STATUSES.filter((s) => s !== "done" && s !== "pending" && s !== "blocked");
  const offenders: string[] = [];
  for (const file of collectAll(root)) {
    if (file.endsWith(join("src", "lifecycle.ts"))) continue;
    const source = readFileSync(file, "utf8");
    // A file that derives from lifecycle.ts is not a second copy, however many
    // status names it happens to mention. The defect being hunted is a hardcoded
    // duplicate that can drift, not a reference that cannot.
    if (/from "[^"]*lifecycle\.ts"/.test(source)) continue;
    if (needles.every((s) => source.includes(s))) offenders.push(relative(root, file));
  }
  if (offenders.length > 0) {
    report.fail(
      `the full lifecycle enum is repeated in: ${offenders.join(", ")}`,
      "reference src/lifecycle.ts, or name only the statuses that file actually cares about",
    );
  } else {
    report.ok("the lifecycle enum appears only in src/lifecycle.ts");
  }
}

/**
 * Every markdown file under `skills/` that is not a SKILL.md.
 *
 * Links were checked in skills and agents and nowhere else, which left the
 * playbooks and references — more than half the prose — unvalidated. That is
 * the exact defect this plugin was written in response to: 125 prose files with
 * no validation at all, and a mode skill forbidding a command two of its own
 * files tell you to run.
 */
function lintReferenceFiles(root: string, report: Report): void {
  const files = collectAll(join(root, "skills")).filter(
    (file) => extname(file) === ".md" && basename(file) !== "SKILL.md",
  );
  if (files.length === 0) {
    report.warn("no reference files under skills/");
    return;
  }
  let broken = false;
  for (const file of files) {
    const before = report.failures.length;
    lintLinks(root, file, readFileSync(file, "utf8"), report);
    if (report.failures.length > before) broken = true;
  }
  if (!broken) report.ok(`${files.length} reference file(s), every relative link resolves`);
}

/**
 * Commands in the prose that would hang the agent that runs them.
 *
 * `rg PATTERN --glob '*.md'` with no path takes ripgrep's stdin form and blocks
 * forever when stdin is not a terminal, which is how every subagent runs a
 * command. One shipped in a playbook whose job is to *start* an investigation,
 * and only a reviewer running it found out.
 *
 * This checks the one shape that has bitten. It is not a shell parser and does
 * not pretend to be: the point is that this particular defect cannot come back
 * quietly.
 */
const STDIN_FORM = /^\s*(?:rg|grep)\s+(?:-[^\s]+\s+|--[a-z-]+(?:=\S+)?\s+|'[^']*'\s+|"[^"]*"\s+)*$/;

function lintCommands(root: string, report: Report): void {
  const files = collectAll(join(root, "skills")).filter((file) => extname(file) === ".md");
  let found = false;
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!/^(?:rg|grep)\s/.test(trimmed)) return;
      // A path argument is anything left once the flags and quoted pattern are
      // consumed. `<file>` and `<target_file>` placeholders count.
      const withoutPattern = trimmed.replace(/'[^']*'|"[^"]*"/g, (m) => `${" ".repeat(m.length)}`);
      const tail = withoutPattern.split(/\s+/).slice(1).filter((part) => part !== "" && !part.startsWith("-"));
      if (tail.length === 0 && STDIN_FORM.test(`${trimmed.replace(/'[^']*'|"[^"]*"/g, "'x' ")} `)) {
        found = true;
        report.fail(
          `${relative(root, file)}:${index + 1}: '${trimmed}' has no path, so it reads stdin and hangs`,
          "append a path; a subagent runs this with stdin open and never gets it back",
        );
      }
    });
  }
  if (!found) report.ok(`${files.length} file(s), no command that would hang on stdin`);
}

function lintLinks(root: string, file: string, source: string, report: Report): void {
  const label = relative(root, file);
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1] ?? "";
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const target = resolve(dirname(file), href.split("#")[0] ?? "");
    if (!existsSync(target)) report.fail(`${label}: broken link to ${href}`);
  }
}

function collect(dir: string, filename: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...collect(path, filename));
    else if (entry === filename) found.push(path);
  }
  return found;
}

/**
 * `.mstack` is data, not plugin source. Session logs and review reports quote
 * the things they are about — a reviewer's report quoted the status enum and
 * the single-source rule flagged it. A report is a dated record of what was
 * true, and editing one to satisfy a linter is what the append-only rule exists
 * to prevent.
 */
const SKIP_DIRS = new Set([".git", ".mstack", "node_modules", "dist", "docs", "examples"]);

function collectAll(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...collectAll(path));
    else if ([".md", ".ts", ".js", ".json"].includes(extname(entry))) found.push(path);
  }
  return found;
}
