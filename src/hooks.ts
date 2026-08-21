import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { runGate } from "./gate.ts";
import { isActive } from "./lifecycle.ts";
import { findStore, type Store } from "./paths.ts";
import { reportFiles, reportKind, roleOf, substantialReports } from "./roles.ts";
import { activeItem, parseState, type Item } from "./state.ts";

/**
 * Hook handlers.
 *
 * This is the half pstack does not have. Skill content enters the conversation
 * once and is never re-read, so anything that must hold for a whole session
 * either lives in a hook or does not hold. Three rules shape every handler
 * below:
 *
 * - `exit 1` does not block. Only `exit 2` does, and a timed-out hook renders
 *   no decision at all, so a gate must never depend on being slow.
 * - Output is capped at 10,000 characters, after which it is written to a file
 *   and replaced by a preview. Stay well under it.
 * - A handler that throws becomes a visible hook error. Every one of these
 *   fails open instead.
 */

const OUTPUT_CAP = 9_000;

export type HookEvent = "SessionStart" | "PostToolUse" | "SubagentStop" | "Stop" | "PreToolUse";

interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  stop_hook_active?: boolean;
  agent_type?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export function readInput(raw: string): HookInput {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as HookInput) : {};
  } catch {
    return {};
  }
}

function context(event: HookEvent, text: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: clamp(text) },
  });
}

function clamp(text: string): string {
  return text.length <= OUTPUT_CAP ? text : `${text.slice(0, OUTPUT_CAP)}\n... (truncated)`;
}

/**
 * SessionStart: put durable state back in front of the model.
 *
 * This also runs on `--resume`, which is the case that matters. A session that
 * resumes without its checkpoint restarts work that was already done.
 */
export function sessionStart(input: HookInput): string | null {
  const store = findStore(input.cwd ?? process.cwd());
  if (store === null) return null;

  const lines: string[] = ["mstack state for this repository:"];
  const item = activeItem(store);
  lines.push(
    item === undefined
      ? "- No active work item."
      : `- Active item ${item.id} \`${item.slug}\` is ${item.status}${item.sdd === true ? " (spec path)" : ""}.`,
  );
  if (item?.decision_required !== undefined) {
    lines.push(`- This item carries decision_required: ${item.decision_required}`);
  }

  const current = readIfPresent(store.current);
  if (current !== null && !isEmptyTemplate(current)) {
    lines.push("", "Last recorded checkpoint (.mstack/progress/current.md):", "", current.trim());
  }
  return context("SessionStart", lines.join("\n"));
}

/**
 * PostToolUse: the cheapest useful check, and nothing more.
 *
 * Cheap is the whole design constraint. A hook that runs the test suite on
 * every edit is a hook someone switches off, so this one only notices edits to
 * files the harness owns. It exits 0 unconditionally: it nudges, it never
 * blocks.
 */
export function postEdit(input: HookInput): string | null {
  const path = typeof input.tool_input?.["file_path"] === "string" ? input.tool_input["file_path"] : "";
  if (path === "") return null;
  const store = findStore(input.cwd ?? process.cwd());
  if (store === null) return null;

  if (path === store.state) {
    try {
      parseState(store.state);
    } catch (error) {
      return context("PostToolUse", `state.json no longer validates: ${(error as Error).message}`);
    }
  }
  if (path === store.history) {
    return context(
      "PostToolUse",
      "history.md is append-only. If an earlier entry was wrong, say so in a later one rather than editing it.",
    );
  }
  return null;
}

/**
 * SubagentStop: confirm the subagent left something on disk.
 *
 * This exists because of a specific failure. A review subagent went idle
 * without writing its report; the analysis lived only in its working context,
 * which the parent never sees, so it would have vanished silently, and it was
 * caught only because someone checked for the file rather than trusting the
 * one-line summary. A reply is not evidence. The file is.
 */
export function subagentStop(input: HookInput): string | null {
  const role = roleOf(input.agent_type);
  const kind = reportKind(input.agent_type);
  if (kind === undefined) return null;

  const store = findStore(input.cwd ?? process.cwd());
  if (store === null) return null;
  const item = activeItem(store);
  if (item === undefined) return null;

  const found = reportFiles(store.progress, kind, item.slug);
  if (found.length === 0) {
    const expected = join(store.progress, `${kind}_${item.slug}.md`);
    return context(
      "SubagentStop",
      `The ${role} subagent finished without writing ${expected} (or a ${kind}_${item.slug}_<lens>.md alongside it). Its reply is not evidence. Re-run it with instructions to write the report before returning, and do not act on the summary alone.`,
    );
  }
  // Judged per file, not in aggregate: one substantial report does not excuse a
  // sibling lens that returned an empty stub. Anything we cannot stat counts as
  // empty — an unguarded stat here threw all the way out of the hook, so a
  // single unreadable entry in progress/ disabled the check entirely.
  const real = new Set(substantialReports(store.progress, kind, item.slug));
  const empty = found.filter((file) => !real.has(file));
  if (empty.length > 0) {
    return context(
      "SubagentStop",
      `${empty.join(", ")} exists but is essentially empty. Treat that as no report.`,
    );
  }
  return null;
}

/**
 * Stop: run the fast gate before the turn ends.
 *
 * Returns `additionalContext` rather than `decision: "block"` on purpose. Both
 * keep the conversation going through the same loop protection, but this one is
 * labelled as feedback instead of raising a hook error, and it avoids burning
 * the eight-consecutive-block budget on something the model can simply fix.
 */
export function stop(input: HookInput): string | null {
  if (input.stop_hook_active === true) return null;
  const store = findStore(input.cwd ?? process.cwd());
  if (store === null) return null;

  const report = runGate(store, { quiet: true });
  if (!report.failed) return null;
  return context(
    "Stop",
    ["The mstack gate is red. Fix these before closing:", ...report.failures.map((f) => `- ${f}`)].join("\n"),
  );
}

interface Guard {
  readonly pattern: RegExp;
  readonly why: string;
}

/**
 * Commands that are hard or impossible to walk back. Hooks are evaluated before
 * the permission mode is consulted, so a deny here holds even under
 * `bypassPermissions`.
 *
 * These are regexes over one shell command at a time, not a shell parser, and
 * the two halves of that pull in opposite directions on purpose.
 *
 * *Within* a command the match is loose, so `echo "do not git push --force"` is
 * denied. Erring that way is recoverable — the author rewrites the line — and
 * the other direction is not.
 *
 * *Across* commands it is not loose at all, because there is nothing to be
 * loose about: a separator ends a command, so text after one cannot be an
 * argument to what came before. `preToolUse` splits on separators first (see
 * `shellSegments`) and matches each piece alone. Skipping that step denied
 * `rm -rf /tmp/x && mstack decide --evidence ".mstack/x.md"`, which deletes
 * nothing any of these rules is about. That is not a tolerable cost the way the
 * `echo` case is: a guard that fires on work the author knows is harmless
 * teaches them to route around it, which is the behaviour the guard exists to
 * prevent.
 *
 * What these cannot see, stated rather than implied away. The input is a
 * command string, so every deletion that does not spell itself out in one is
 * allowed:
 *
 * - an interpreter one-liner — `node -e "fs.rmSync('.mstack',{recursive:true})"`,
 *   `python -c ...`, anything through `sh -c` with the path concatenated;
 * - a tool that removes a tree without the word `rm` in front of the path —
 *   `find .mstack -delete`, `fd . .mstack -X rm`, `git clean -xdf`;
 * - the path arriving indirectly — `rm -rf "$STORE"`, `rm -rf $(ls -d .mst*)`;
 * - two steps — `mv .mstack /tmp/x`, then a deletion of `/tmp/x`.
 *
 * No regex closes those; the state they are about is on the filesystem, and a
 * PreToolUse hook only ever sees the string. Read this array as a speed bump in
 * front of the obvious spelling, not as a sandbox.
 */
/**
 * `git` accepts global options before the subcommand, so `git push` is not
 * adjacent in `git -C /repo push`, `git -c k=v push`, `git --git-dir=... push`.
 * Every one of those slipped straight past a `\bgit\s+push\b`. This eats the
 * options rather than trying to enumerate them.
 */
const GIT = String.raw`\bgit\s+(?:-[cC]\s+\S+\s+|--(?:git-dir|work-tree|namespace|exec-path|config-env)(?:=\S+)?\s+|-{1,2}[a-zA-Z-]+\s+)*`;

export const GUARDS: readonly Guard[] = [
  {
    // `--force(?![-\w])` is load-bearing: `\b` matches between "e" and "-",
    // so a plain `--force\b` also matches inside `--force-with-lease` and
    // denies the safe form this rule is telling people to use.
    pattern: new RegExp(`${GIT}push\\b[^\\n]*\\s(?:--force(?![-\\w])|-f(?=\\s|$))`),
    why: "force-push rewrites history other people may have pulled; use --force-with-lease, or ask first",
  },
  {
    // A leading `+` on a refspec is a force push spelled differently, and it is
    // the spelling that reads as harmless. `git push origin +main` rewrites the
    // remote exactly as `--force` would.
    pattern: new RegExp(`${GIT}push\\b[^\\n]*\\s\\+[^\\s-]\\S*`),
    why: "a leading + on a refspec is a force push; use --force-with-lease, or ask first",
  },
  {
    pattern: new RegExp(`${GIT}reset\\s+(?:--hard\\b|--\\S+\\s+)*--hard\\b`),
    why: "git reset --hard discards uncommitted work with no undo; commit or stash first",
  },
  {
    // Long and short spellings, in either order, and the `-d --force` pair that
    // means the same thing as `-D`. The comment used to claim that last case
    // and the pattern did not cover it.
    pattern: new RegExp(
      `${GIT}branch\\b(?=[^\\n]*\\s(?:-[a-zA-Z]*D[a-zA-Z]*(?![-\\w])|--force(?![-\\w])))(?=[^\\n]*\\s(?:-[a-zA-Z]*[Dd][a-zA-Z]*(?![-\\w])|--delete(?![-\\w])|-[a-zA-Z]*D))`,
    ),
    why: "deleting an unmerged branch loses the work on it; use -d, which refuses when that would happen",
  },
  {
    pattern: /\bgh\s+pr\s+merge\b[^\n]*--admin\b/,
    why: "--admin merges past a check gh would otherwise refuse; fix the check instead",
  },
  {
    // `.mstack*` and `.mstac?` reach the same directory through the shell, so
    // the guard matches the prefix rather than the exact name. The `[^\n]*`
    // between the flags and the name is what let this rule read a store name
    // out of the *next* command; it is safe now only because the input is one
    // segment, so treat `shellSegments` as part of this pattern.
    pattern: /\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*[^\n]*(?:\.mstack|\.mstac[^\s\/]|\.msta[^\s\/]{0,2}\*)/,
    why: "that would delete the durable state this workflow runs on",
  },
];

/**
 * Cut a command line where the shell would start a new command.
 *
 * `&&`, `||`, `;`, `&`, `|` and a newline each end one command and begin
 * another. Every guard above matches a verb together with its arguments, so
 * running one against a whole line lets it take the verb from one command and
 * the argument from another and deny a line that does neither thing.
 *
 * This is a scanner, not a parser, and it tracks exactly three things:
 *
 * - Quotes. A separator inside `'...'` or `"..."` is a filename character.
 * - Backslash escapes, outside single quotes, for the same reason.
 * - Redirections. The `&` of `2>&1` and of `&>log` belongs to the redirection,
 *   and `>|` is a clobbering redirect rather than a pipe.
 *
 * The first two lean one way and the third leans the other, deliberately.
 * Refusing to split inside a quote leaves the segment longer, so the guards see
 * more and deny more; if the quoting is misread the cost is a false denial the
 * author can rewrite. Refusing to split a redirection is the opposite case:
 * cutting `git push origin main 2>&1 --force` in half hides `--force` from the
 * rule that exists to catch it, and a false *allow* is the one outcome nothing
 * downstream recovers from.
 *
 * Everything it still gets wrong — `$(...)` holding a separator, a heredoc — it
 * gets wrong by leaving a segment too long, which denies rather than allows.
 */
export function shellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i] as string;
    if (quote !== "'" && char === "\\" && i + 1 < command.length) {
      current += char + command[i + 1];
      i += 1;
      continue;
    }
    if (quote !== null) {
      if (char === quote) quote = null;
      current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (isSeparator(command, i)) {
      segments.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments.map((segment) => segment.trim()).filter((segment) => segment !== "");
}

function isSeparator(command: string, index: number): boolean {
  const char = command[index];
  if (char === "\n" || char === ";") return true;
  if (char !== "&" && char !== "|") return false;
  // `2>&1`, `2>|out`, `<&3`: the character belongs to the redirection operator.
  const previous = command[index - 1];
  if (previous === ">" || previous === "<") return false;
  // `&>log` and `&>>log` redirect both streams; that `&` starts nothing.
  if (char === "&" && command[index + 1] === ">") return false;
  return true;
}

export function preToolUse(input: HookInput): string | null {
  if (input.tool_name !== "Bash") return null;
  const command = typeof input.tool_input?.["command"] === "string" ? input.tool_input["command"] : "";
  if (command === "") return null;

  // Every guard is judged per segment, not just the rm one. Five of the six
  // patterns above carry the same `[^\n]*` shape and had the same defect —
  // `git reset --hard` escaped only because its pattern happens to be anchored
  // tighter, which is luck, not design. Making this per-guard would mean the
  // same mechanism written five times and forgotten on the seventh rule.
  const segments = shellSegments(command);
  const hit = GUARDS.find((g) => segments.some((segment) => g.pattern.test(segment)));
  if (hit === undefined) return null;

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `mstack: ${hit.why}`,
    },
  });
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function isEmptyTemplate(body: string): boolean {
  return body.includes("- **Item:** _none_");
}
