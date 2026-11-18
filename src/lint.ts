import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import { asList, parse, type Value } from "./frontmatter.ts";
import { HOOK_COMMANDS } from "./hooklog.ts";
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

  report.section("provenance");
  lintOrigins(dir, report);

  report.section("router");
  lintRouterIntake(dir, report);

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
  lintPreloadedSkills(root, label, data["skills"], report);
  lintLinks(root, file, source, report);
  if (!report.failed) report.ok(label);
}

/**
 * Each `skills` entry of an agent is a skill this plugin ships that the model
 * may be given. Claude Code skips a missing or model-hidden skill with a line
 * in the debug log, so a misspelling or an added `disable-model-invocation`
 * would quietly remove the reference the agent was written around. An entry
 * namespaced to another plugin is not this plugin's to check.
 */
function lintPreloadedSkills(root: string, label: string, value: Value | undefined, report: Report): void {
  const entries = asList(value);
  if (entries.length === 0) return;
  const own = pluginName(root);
  const shipped = new Map<string, boolean>();
  for (const file of collect(join(root, "skills"), "SKILL.md")) {
    const { data } = parse(readFileSync(file, "utf8"));
    shipped.set(nameOf(file) ?? basename(dirname(file)), data["disable-model-invocation"] === true);
  }
  for (const entry of entries) {
    const name = own !== null && entry.startsWith(`${own}:`) ? entry.slice(own.length + 1) : entry;
    if (name.includes(":")) continue;
    const hidden = shipped.get(name);
    if (hidden === undefined) {
      report.fail(
        `${label}: skills entry '${entry}' names no skill under skills/`,
        `shipped skills: ${[...shipped.keys()].sort().join(", ")}`,
      );
    } else if (hidden) {
      report.fail(
        `${label}: skills entry '${entry}' has disable-model-invocation: true, so it is not preloaded`,
        "remove that key from the skill, or drop it from the agent",
      );
    }
  }
}

function pluginName(root: string): string | null {
  try {
    const data = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8")) as { name?: unknown };
    return typeof data.name === "string" ? data.name : null;
  } catch {
    return null;
  }
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
  lintHookArguments(data.hooks ?? {}, report);
}

/**
 * `hooks.json` names the event twice: Claude Code's own name for when to run
 * the hook, and the argument the CLI is called with. The first is checked
 * above. A misspelt second one is not caught by anything else, because the
 * hook runs, the CLI does not know the name, and the handler is skipped with
 * an exit 0. The list of names is the one `mstack hook` dispatches on.
 */
function lintHookArguments(hooks: Record<string, unknown>, report: Report): void {
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups as { hooks?: unknown }[]) {
      if (!Array.isArray(group?.hooks)) continue;
      for (const entry of group.hooks as { args?: unknown }[]) {
        const args = entry?.args;
        if (!Array.isArray(args) || args[0] !== "hook") continue;
        const name = String(args[1] ?? "");
        if ((HOOK_COMMANDS as readonly string[]).includes(name)) continue;
        const near = HOOK_COMMANDS.find((c) => c.replace(/-/g, "") === name.toLowerCase().replace(/-/g, "") || (name.length > 3 && distance(c, name) <= 2));
        report.fail(
          `hooks.json: '${event}' runs 'mstack hook ${name}', and the CLI does not handle that event, so the hook would do nothing`,
          near !== undefined ? `did you mean '${near}'? handled: ${HOOK_COMMANDS.join(", ")}` : `handled: ${HOOK_COMMANDS.join(", ")}`,
        );
      }
    }
  }
}

/** Levenshtein distance, for a suggestion only. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j] as number;
      row[j] = Math.min(above + 1, (row[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = above;
    }
  }
  return row[b.length] as number;
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
 * Files under `skills/` and `agents/` whose text is derived from another repository, so each
 * must carry an `<!-- Origin: ... -->` header. This is the one place the list is
 * declared; a new derived file is added here and the rule covers it.
 */
const ORIGIN_REQUIRED = [
  "skills/router/references/intake.md",
  "skills/test-first/SKILL.md",
  "skills/design/references/deep-modules.md",
  "skills/router/playbooks/deepen.md",
  "skills/router/playbooks/bug-fix.md",
  "skills/reflect/references/domain-docs.md",
  "skills/verify/SKILL.md",
  "skills/router/references/evidence-ladder.md",
  "agents/implementer.md",
];

/**
 * Every origin header in a skill or agent file names a licence file the plugin
 * ships under `licenses/`, and every file in ORIGIN_REQUIRED has a header.
 * Without this, deleting a header or a licence leaves the derived text
 * unattributed with nothing red.
 */
function lintOrigins(root: string, report: Report): void {
  const header = /<!--\s*Origin:([\s\S]*?)-->/;
  let problems = 0;
  let headers = 0;
  const files = new Set(
    [...collectAll(join(root, "skills")), ...collectAll(join(root, "agents"))].filter((f) => extname(f) === ".md"),
  );
  for (const required of ORIGIN_REQUIRED) {
    const file = join(root, required);
    if (existsSync(file)) files.add(file);
  }
  for (const file of files) {
    const label = relative(root, file);
    const match = header.exec(readFileSync(file, "utf8"));
    if (match === null) {
      if (ORIGIN_REQUIRED.includes(label)) {
        problems += 1;
        report.fail(`${label}: no origin header`, "the text is derived; restore the <!-- Origin: ... --> comment");
      }
      continue;
    }
    headers += 1;
    const licences = [...(match[1] ?? "").matchAll(/licenses\/[A-Za-z0-9._-]+/g)].map((m) => m[0]);
    if (licences.length === 0) {
      problems += 1;
      report.fail(`${label}: origin header names no file under licenses/`, "name the licence file that ships with the plugin");
    }
    for (const licence of new Set(licences)) {
      if (!existsSync(join(root, licence))) {
        problems += 1;
        report.fail(`${label}: origin header names ${licence}, which does not exist`, "ship the licence text it names");
      }
    }
  }
  if (problems === 0) report.ok(`${headers} origin header(s), each naming a licence file that ships`);
}

/**
 * The router's orient steps link `references/intake.md`. Intake is a step in
 * prose, so deleting it changes no other file, and the router's later mentions
 * of intake would still resolve while no new request went through it.
 */
function lintRouterIntake(root: string, report: Report): void {
  const file = join(root, "skills", "router", "SKILL.md");
  if (!existsSync(file)) return;
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("## First, orient");
  const end = source.indexOf("\n## ", start + 1);
  const orient = start === -1 ? "" : source.slice(start, end === -1 ? undefined : end);
  if (/\]\(references\/intake\.md\)/.test(orient)) {
    report.ok("the router's orient steps link references/intake.md");
  } else {
    report.fail(
      "skills/router/SKILL.md: the orient steps do not link references/intake.md",
      "intake is the router's step 3; restore it under '## First, orient'",
    );
  }
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
