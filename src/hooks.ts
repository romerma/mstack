import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import * as costs from "./costs.ts";
import { runGate } from "./gate.ts";
import { isActive } from "./lifecycle.ts";
import * as hooklog from "./hooklog.ts";
import { BY_HAND, checkLock, FOR_A_PERSON, inLockStore, LOCK_NAME, readLockAt, restoreCommand, type Lock } from "./mutation-lock.ts";
import { findStore, type Store } from "./paths.ts";
import { reportFiles, reportKind, roleOf, substantialReports } from "./roles.ts";
import { parseState, type Item } from "./state.ts";

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

export type HookEvent = "SessionStart" | "PostToolUse" | "SubagentStop" | "Stop" | "PreToolUse" | "SessionEnd";

interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  stop_hook_active?: boolean;
  transcript_path?: string;
  agent_id?: string;
  agent_type?: string;
  /** Empty for a subagent whose transcript the harness never wrote, e.g. a compaction. */
  agent_transcript_path?: string;
  /** SessionEnd only: why the session ended. */
  reason?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

/**
 * Why `raw` is not a hook input, or null when it is one or when there is none.
 *
 * An empty stdin is a hook run by hand, not a fault. Anything else that is not
 * a JSON object means the harness sent something this parser does not
 * understand, and `readInput` answers `{}` for it, which every handler then
 * reads as "nothing to do".
 */
export function inputProblem(raw: string): string | null {
  if (raw.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? null : "hook input is not a JSON object";
  } catch {
    return "hook input is not JSON";
  }
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
  const text = sessionStartContext(store);
  // After the output exists, and fenced: cost recording is not allowed to change
  // what the model is told, however it fails.
  safely(() => costs.onSessionStart(store, input));
  return text;
}

/**
 * `activeItem` answers "none" for a `state.json` it cannot read, which is the
 * right answer for a caller that only needs to know whether there is something
 * to show, and a false one for the model told "No active work item" about a
 * store that has one. The text is left as it was; the failure is written down.
 */
function activeItemOrLog(store: Store): Item | undefined {
  try {
    return parseState(store.state).items.find((i) => isActive(i.status));
  } catch (error) {
    hooklog.noteFailure("state.json could not be read", error);
    return undefined;
  }
}

function sessionStartContext(store: Store): string {
  const lines: string[] = ["mstack state for this repository:"];
  const item = activeItemOrLog(store);
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
 * Run cost work whose failure must be invisible.
 *
 * A transcript parser, a full disk, a corrupt marks file: none of those is
 * worth a visible hook error or a different answer from the hook that called
 * this. The cost is a missing row, which the next flush recomputes.
 */
function safely(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    // Invisible to the user and to the model, by design; not invisible on disk.
    hooklog.noteFailure("cost recording", error);
  }
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
  const item = activeItemOrLog(store);
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

  // Existing is not the same as written by this subagent. A round-2 reviewer
  // that returns without writing left round 1's report in place, and the
  // existence check above passed on it. The agent's own transcript says when it
  // started, so at least one report has to be newer than that. When the
  // transcript cannot be found or read there is no start time to compare, and
  // the answer stays what it was: fail open, never accuse on a guess.
  //
  // Known limits, stated rather than hidden. `some` means a panel lens that
  // wrote nothing passes once a sibling's report is newer than its start;
  // `mstack fanout check` is the guard that names the lens. And a subagent
  // resumed later keeps its original first timestamp, so a report from before
  // the resume still counts as fresh.
  const startedAt = agentStartedAt(input);
  if (startedAt !== null) {
    const fresh = found.some((file) => {
      try {
        return statSync(file).mtimeMs > startedAt;
      } catch (error) {
        hooklog.tolerateAbsence(`cannot stat report ${file}`, error);
        return false;
      }
    });
    if (!fresh) {
      return context(
        "SubagentStop",
        `The ${role} subagent finished, but every ${kind}_${item.slug} report on disk (${found.map((f) => f.split("/").pop()).join(", ")}) is older than the subagent itself. Those are an earlier round's, not this one's. Re-run it with instructions to write its own report (a later round writes ${kind}_${item.slug}_r<N>.md) before returning.`,
      );
    }
  }
  return null;
}

/**
 * When the subagent began, from the first timestamp of its own transcript.
 *
 * `agent_transcript_path` can be an empty string, so the path is derived from
 * the parent transcript and the agent id when it is: the layout measured on
 * this machine is `<session>.jsonl` beside a `<session>/subagents/agent-<id>.jsonl`.
 */
function agentStartedAt(input: HookInput): number | null {
  let path = input.agent_transcript_path ?? "";
  if (path === "") {
    const parent = input.transcript_path ?? "";
    const id = input.agent_id ?? "";
    if (parent === "" || id === "") return null;
    path = join(dirname(parent), basename(parent, ".jsonl"), "subagents", `agent-${id}.jsonl`);
  }
  return costs.firstTimestamp(path);
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
  const store = findStore(input.cwd ?? process.cwd());
  if (store === null) return null;
  const output = input.stop_hook_active === true ? null : gateFeedback(store);
  // A stat and a compare: a mark is written only when the active item changed.
  safely(() => costs.onStop(store, input));
  return output;
}

function gateFeedback(store: Store): string | null {
  const report = runGate(store, { quiet: true });
  if (!report.failed) return null;
  return context(
    "Stop",
    ["The mstack gate is red. Fix these before closing:", ...report.failures.map((f) => `- ${f}`)].join("\n"),
  );
}

/**
 * SessionEnd: settle this session's token usage into `.mstack/costs.tsv`.
 *
 * Says nothing, whatever happens. The transcript's cost-state line is already
 * on disk when this runs (measured, not assumed), so this is where the
 * reconciliation against the real figure can happen.
 */
export function sessionEnd(input: HookInput): string | null {
  const store = findStore(input.cwd ?? process.cwd());
  if (store === null) return null;
  safely(() => costs.onSessionEnd(store, input));
  return null;
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
 * options rather than trying to enumerate them. `--git-dir`, `--work-tree`,
 * `--namespace`, `--config-env` and `--attr-source` also take their value after
 * a space, as `-C` and `-c` do (git.c's `handle_options`; item 101).
 */
const GIT = String.raw`\bgit\s+(?:-[cC]\s+\S+\s+|--(?:git-dir|work-tree|namespace|config-env|attr-source)\s+\S+\s+|--(?:git-dir|work-tree|namespace|exec-path|config-env|attr-source)(?:=\S+)?\s+|-{1,2}[a-zA-Z-]+\s+)*`;

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
  {
    // A path that ends in the lock's name: `rm .git/mstack-mutation.lock.<run>.tmp`
    // is a temp file and is not this. It reads no lock and starts no git, so it
    // holds with or without one, and names `mstack gate` for the restore command.
    pattern: /\brm\s[^\n]*mstack-mutation\.lock["']?(?=\s|$)/,
    why: "that deletes the lock of a mutation run, which leaves the item's code reverted with no record of it; `mstack gate` names the restore command",
  },
];

/**
 * Item 42, R26. Git commands that write the index, the tree or a ref: while a
 * mutation run holds the lock, the tree holds reverted code, and a commit, an add
 * or a stash would keep it, or lose it. Matched per segment like the guards, so it
 * is as loose within a command and as blind to an alias, `"git"`, an interpreter
 * one-liner or `git -C "a b"` as they are.
 *
 * The plumbing after them is the same writes spelled low (item 101): the index
 * from the tree (`update-index`) or from a tree object (`read-tree`, which can
 * also write the tree), the tree from the index (`checkout-index`), a tree object
 * (`write-tree`, `mktree`), a commit (`commit-tree`) and a ref (`update-ref`).
 * None of them has a form that only reads. What is left out either reads, or
 * cannot save the reverted tree, since nothing above makes an object of it:
 * `hash-object -w` (the reverted content is the start's blob, already an
 * object), `symbolic-ref`, `branch` and `tag` (a ref to a commit that exists;
 * each has a form that only reads), `sparse-checkout` (it leaves a modified
 * file in place), and every other command git has.
 */
const LOCKED_GIT = new RegExp(
  `${GIT}(?:add|am|apply|checkout|cherry-pick|clean|commit|merge|mv|pull|rebase|reset|restore|revert|rm|stash|switch` +
    `|update-index|read-tree|checkout-index|write-tree|mktree|commit-tree|update-ref)(?![-\\w])`,
);

/**
 * The deny reason when the lock exists in `cwd`'s git directory, or null. Only the
 * lock's existence decides: a lock that does not parse denies too, with less to say.
 * No git process starts unless a segment is a listed git command.
 */
function lockReason(cwd: string): string | null {
  const gitDir = gitAnswer(cwd, ["rev-parse", "--absolute-git-dir"]);
  if (gitDir === null) return null;
  const file = join(gitDir, LOCK_NAME);
  try {
    lstatSync(file);
  } catch (error) {
    // Anything but "not there" (no permission, say) is a lock we cannot rule out.
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return null;
  }
  const lead = `mstack: ${file} exists, so a mutation run has this tree's code reverted and a git command that writes would keep or lose that`;
  const parsed = readLockRecord(file);
  if (parsed === null) return `${lead}. The lock cannot be read as a run's record, so the way out is ${FOR_A_PERSON}: ${BY_HAND}; 'mstack gate' says the same`;
  // The restore runs from the lock's own store: two stores of one worktree share its lock.
  const held = `${lead}. It is held by pid ${parsed.pid}`;
  const restore = restoreCommand(parsed.cli);
  const top = gitAnswer(cwd, ["rev-parse", "--show-toplevel"]);
  if (top === null) {
    return `${held}: ${restore.lead}wait for it, or if it is not running, run from ${parsed.rootFromTop} under this worktree's top level: ${restore.command}`;
  }
  // The `cd` only to a store whose restore takes the lock: a spelling that differs only in case or Unicode form would loop (item 101, A3).
  const way = inLockStore(restore, top, parsed.rootFromTop);
  if ("line" in way) return `${held}: ${way.lead}wait for it, or if it is not running, run ${way.line}`;
  return `${held}: wait for it, or if it is not running: ${way.none}, so the way out is ${FOR_A_PERSON}: ${BY_HAND}; 'mstack gate' says the same`;
}

function gitAnswer(cwd: string, args: readonly string[]): string | null {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4_000,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
    return out === "" ? null : out;
  } catch {
    return null;
  }
}

/**
 * The lock, read as the gate, R1 and the restore read it (`readLockAt`: a
 * regular file, opened without following a link and without blocking on a
 * FIFO) and accepted by `checkLock`, with its CLI path absolute; else null, and
 * the reason is the by-hand one, as the gate's line is (item 101, A2; round 1
 * review, B2).
 */
function readLockRecord(file: string): Lock | null {
  const held = readLockAt(file);
  if (held === null) return null;
  const checked = checkLock(held, file);
  return "lock" in checked && checked.lock.cli.startsWith("/") ? checked.lock : null;
}

/**
 * Cut a command line where the shell would start a new command.
 *
 * `&&`, `||`, `;`, `&`, `|` and a newline each end one command and begin
 * another. Every guard above matches a verb together with its arguments, so
 * running one against a whole line lets it take the verb from one command and
 * the argument from another and deny a line that does neither thing.
 *
 * Exported for `tests/hooks.test.ts` rather than for any caller: where the cuts
 * fall *is* the contract, and asserting it through `preToolUse` would only ever
 * show that some guard did or did not fire, which is a weaker statement.
 *
 * ## The rule that governs every change to this function
 *
 * A construct it cannot model must leave a segment too **long**, never too
 * short. The two directions are not symmetric and never will be:
 *
 * - Too long over-denies. The guards see text from a neighbouring command and
 *   refuse something harmless. The author rewrites the line and moves on.
 * - Too short under-denies. One command is cut so the verb lands in one
 *   fragment and its argument in another, and then *no guard matches either*.
 *   Nothing downstream recovers from that.
 *
 * This is not a hypothetical ordering of harms. The first version of this
 * scanner split inside `$(...)`, and `rm -rf $(cd /r && pwd)/.mstack` — denied
 * by the un-segmented guard it replaced — became allowed, along with 29 other
 * spellings across every rule in the array. Read the list below as the set of
 * places that rule is being enforced, not as a feature list.
 *
 * ## What it models
 *
 * - Quotes. A separator inside `'...'` or `"..."` is a filename character.
 * - Backslash escapes, outside single quotes, for the same reason.
 * - Redirections. The `&` of `2>&1` and of `&>log` belongs to the redirection,
 *   and `>|` is a clobbering redirect rather than a pipe. This one is not about
 *   erring long: cutting `git push origin main 2>&1 --force` in half hides
 *   `--force` from the rule that exists to catch it.
 * - Substitution depth. Inside `$(...)`, `` `...` ``, `<(...)`, `>(...)` and
 *   `$((...))` — and inside any parenthesis nested within one — nothing is a
 *   separator, because the whole construct is one word of the command that
 *   contains it. An opener with no closer holds the rest of the line in a
 *   single segment, which is the long direction.
 *
 * ## What it does not model, and which way each one fails
 *
 * - A heredoc body is scanned as though it were command text. Fails long: a
 *   body line that reads like a destructive command is denied even though it is
 *   data. Nothing is hidden, because each body line is already whole.
 * - `[[ a && b ]]`, `((i && j))` as a command rather than an expansion, and
 *   `case` patterns spelled with `|` are all cut internally. Fails short, but
 *   none of them is a command with a destructive verb and an argument to
 *   separate, so nothing the guards look for can straddle the cut. That is an
 *   argument, not a test — it is the first place to look if a bypass appears.
 * - `isSeparator` re-indexes the raw string, so it cannot tell that a preceding
 *   `>` was itself escaped: `cmd a\>|grep x` reads as a `>|` redirect. Fails
 *   long.
 */
export function shellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: string | null = null;
  let backtick = false;
  let depth = 0;

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
    // Backticks have no nesting to track: the inner ones are backslash-escaped
    // and the escape branch above has already eaten them.
    if (char === "`") {
      backtick = !backtick;
      current += char;
      continue;
    }
    // `depth > 0` is what carries `$((...))` and a plain subshell written
    // inside a substitution. Without it the first `)` of `$( (a) && b )` drops
    // the depth to zero and the `&&` splits a command that has not ended.
    if (char === "(" && (depth > 0 || opensSubstitution(command[i - 1]))) {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")" && depth > 0) {
      depth -= 1;
      current += char;
      continue;
    }
    if (depth === 0 && !backtick && isSeparator(command, i)) {
      segments.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments.map((segment) => segment.trim()).filter((segment) => segment !== "");
}

/**
 * `$(`, `<(` and `>(` open a construct whose contents are an argument to the
 * surrounding command. A bare `(` does not: it is a subshell, and the commands
 * inside it really are separate, so cutting there is right.
 */
function opensSubstitution(previous: string | undefined): boolean {
  return previous === "$" || previous === "<" || previous === ">";
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

  // Every guard is judged per segment, not just the rm one. All but one of the
  // patterns above carry the same `[^\n]*` shape and had the same defect; the
  // exception is `git reset --hard`, which escaped only because its pattern
  // happens to be anchored tighter, and that is luck rather than design. Making
  // this per-guard would mean the same mechanism written five times and
  // forgotten on the seventh rule.
  const segments = shellSegments(command);
  const hit = GUARDS.find((g) => segments.some((segment) => g.pattern.test(segment)));
  if (hit === undefined) {
    if (!segments.some((segment) => LOCKED_GIT.test(segment))) return null;
    const reason = lockReason(input.cwd ?? process.cwd());
    return reason === null ? null : deny(reason);
  }

  return deny(`mstack: ${hit.why}`);
}

function deny(reason: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  });
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    hooklog.tolerateAbsence(`cannot read ${path}`, error);
    return null;
  }
}

function isEmptyTemplate(body: string): boolean {
  return body.includes("- **Item:** _none_");
}
