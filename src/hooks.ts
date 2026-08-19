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
 * without writing its report; the parent never sees a subagent's reply body, so
 * that analysis would have vanished silently, and it was caught only because
 * someone checked for the file rather than trusting the one-line summary. A
 * reply is not evidence. The file is.
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
 * These are regexes over the command string, not a shell parser, and the
 * consequence is deliberate: `echo "do not git push --force"` is denied. Erring
 * that way is recoverable — the author rewrites the line — and the other
 * direction is not. Carrying a shell parser to fix it would buy accuracy on a
 * case nobody hits and add a whole grammar to a hook that must never be the
 * thing that breaks a session.
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
    // the guard matches the prefix rather than the exact name.
    pattern: /\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*[^\n]*(?:\.mstack|\.mstac[^\s\/]|\.msta[^\s\/]{0,2}\*)/,
    why: "that would delete the durable state this workflow runs on",
  },
];

export function preToolUse(input: HookInput): string | null {
  if (input.tool_name !== "Bash") return null;
  const command = typeof input.tool_input?.["command"] === "string" ? input.tool_input["command"] : "";
  if (command === "") return null;

  const hit = GUARDS.find((g) => g.pattern.test(command));
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
