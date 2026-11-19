import { constants } from "node:os";

import { headSha } from "./git.ts";
import { isActive } from "./lifecycle.ts";
import { mutationKey, refusals, revertSet, type MutationKey } from "./mutation.ts";
import { acquireLock, discard, errorText, lockPath, prepareRun, restoreCommand, sweepStale, type Lock } from "./mutation-lock.ts";
import { applyRevert, restoreFromLock, type Restored } from "./mutation-tree.ts";
import { runningCliRoot, type Store } from "./paths.ts";
import { runCommandAsync, type RunResult } from "./run.ts";
import { measureStart, resolveCommit } from "./size.ts";
import { parseState, type Item, type State } from "./state.ts";
import { obligations, record, recordMutation, status, treeId, UNKNOWN_TREE, type MutationOutcome, type Obligation } from "./verification.ts";

/**
 * `mstack verify --mutation` (item 42, `.mstack/specs/mutation-check/design.md`,
 * "The run"): the item's code reverted in place behind the lock, the project's
 * verification run on that tree, the tree put back and proved, and one row in
 * `verification.tsv` saying whether anything noticed.
 */

export interface MutationOptions {
  /** Each command, at the baseline and on the reverted tree, and its whole process group, is killed after this long. */
  readonly timeoutMs: number;
  /** The root of the mstack copy that is running: a revert under it is refused (R5). */
  readonly running?: string;
  /** The test seam: `prepared`, `lock-written`, `obligations-running`, and the revert's and the restore's own steps. */
  readonly step?: (name: string) => void;
  /** One line of output; an error it throws is swallowed, so a closed terminal cannot stop a restore. */
  readonly out: (line: string) => void;
}

export type Verdict = "passed" | "failed" | "blocked";

/**
 * A command's result as the run reads it: exit 0 passes; 126 and 127 (cannot
 * execute, not found), a timeout, a failure to start and a death by a signal
 * are blocked; any other code, 128+n included, failed (on the reverted tree, a
 * kill).
 */
export function classify(result: RunResult): Verdict {
  if (result.timedOut || result.error !== undefined || result.signal !== null || result.code === null) return "blocked";
  if (result.code === 0) return "passed";
  if (result.code === 126 || result.code === 127) return "blocked";
  return "failed";
}

/** How many lines of a command's output a kill or a block prints (R12). */
const TAIL = 20;
const short = (sha: string): string => sha.slice(0, 8);
const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const bound = (ms: number): string => `${ms / 1000}s`;

/** What a command did, in a few words. */
function said(result: RunResult, timeoutMs: number): string {
  if (result.timedOut) return `timed out after ${bound(timeoutMs)}`;
  if (result.error !== undefined) return `could not be started: ${result.error}`;
  if (result.signal !== null) return `was ended by ${result.signal}, a signal mstack did not send`;
  const code = result.code as number;
  if (code === 126) return "exit 126 (the command could not be executed)";
  if (code === 127) return "exit 127 (the command was not found)";
  if (code > 128 && code < 192) {
    const name = Object.entries(constants.signals).find(([, n]) => n === code - 128)?.[0];
    return `exit ${code} (signal ${code - 128}${name === undefined ? "" : `, ${name}`})`;
  }
  return `exit ${code}`;
}

function printTail(out: (line: string) => void, command: string, tail: string): void {
  if (tail === "") {
    out(`mutation: \`${command}\` printed nothing`);
    return;
  }
  out(`mutation: the last ${TAIL} lines of \`${command}\`:`);
  for (const line of tail.split("\n")) out(`  | ${line}`);
}

function refuse(out: (line: string) => void, message: string, fix: string): number {
  out(`mutation: refused: ${message}`);
  out(`mutation: ${fix}`);
  return 2;
}

/** The paths whose line in the key differs between two keys. */
function keyChanges(before: MutationKey, after: MutationKey): string[] {
  if (before.key === null || after.key === null) return [];
  const paths = new Set([...before.lines.keys(), ...after.lines.keys()]);
  return [...paths].filter((p) => before.lines.get(p) !== after.lines.get(p)).sort();
}

/** At most ten, then how many more. */
function some(paths: readonly string[]): string {
  const shown = paths.slice(0, 10).join(", ");
  return paths.length > 10 ? `${shown} and ${paths.length - 10} more` : shown;
}

/** Print what a restore did: what it moved aside, what it left, and what it could not put back. */
export function reportRestore(out: (line: string) => void, restored: Restored): void {
  for (const r of restored.rescued) out(`mutation: rescued ${r.path} to ${r.to}`);
  for (const p of restored.left) out(`mutation: left where it is: ${p}: it holds what the run did not write`);
  for (const f of restored.failed) out(`mutation: not restored: ${f.path}: ${f.reason}; to do: ${f.fix}`);
  if (restored.failed.some((f) => /\bgit (stash|restore)\b/.test(f.fix))) {
    out("mutation: the git commands above are for a person at a terminal: while the lock exists, the hook denies them to an agent");
  }
}

type Ending =
  | { readonly kind: "killed" | "blocked"; readonly command: string; readonly result: RunResult }
  | { readonly kind: "blocked"; readonly reason: string }
  | { readonly kind: "survived" };

/** The restore, never thrown out of: a throw is a failure, and the lock stays. */
function restore(store: Store, lock: Lock, entries: readonly number[] | undefined, step: (name: string) => void): Restored {
  try {
    return restoreFromLock(store, lock, { step, ...(entries === undefined ? {} : { entries }) });
  } catch (error) {
    return { restored: 0, rescued: [], left: [], failed: [{ path: ".", reason: `the restore stopped: ${errorText(error)}`, fix: "clear the cause" }] };
  }
}

export async function runMutation(store: Store, options: MutationOptions): Promise<number> {
  const out = (line: string): void => {
    try {
      options.out(line);
    } catch {
      // A closed terminal: the run and its restore go on.
    }
  };
  const step = options.step ?? ((): void => {});
  const running = options.running ?? runningCliRoot();
  const { timeoutMs } = options;

  let state: State;
  try {
    state = parseState(store.state);
  } catch (error) {
    return refuse(out, `the store's state cannot be read: ${errorText(error)}`, "'mstack gate' says what is wrong with it");
  }
  const found = state.items.find((i) => isActive(i.status));
  const refused = refusals(store, state, found, running);
  if (refused !== null) return refuse(out, refused.message, refused.fix);
  // The refusals passed, so the item, its base and its start resolve.
  const item = found as Item;
  const start = measureStart(store, resolveCommit(store, item.base as string) as string);
  const from = start.from as string;
  const set = revertSet(store, from);
  const head0 = headSha(store);
  if (set === null || head0 === null) return refuse(out, `git could not list the code changed since ${short(from)}`, "run it again; if it persists, check 'git status'");
  const k0 = mutationKey(store, from);
  if (k0.key === null) return refuse(out, `no receipt could be keyed: ${k0.reason}`, "nothing was changed; the receipt is keyed by the code and test files, so such a name cannot be checked");
  const commands = obligations(state, item);
  const joined = commands.map((c) => c.command).join(" && ");
  out(`mutation: ${item.slug} (${item.id}), start ${short(from)} (${start.why}), ${set.entries.length} code file(s) to revert`);

  // The baseline (R6, R7): a green recorded at this commit and tree, or every command run now.
  const tree0 = treeId(store);
  const recorded = tree0 !== UNKNOWN_TREE && status(store, state, item, head0, tree0).satisfied;
  if (recorded) {
    for (const c of commands) out(`mutation: baseline: \`${c.command}\` recorded green at this tree, not re-run`);
  } else {
    const ran: { readonly command: Obligation; readonly outcome: "passed" | "failed" }[] = [];
    let red: { readonly command: string; readonly result: RunResult } | null = null;
    for (const c of commands) {
      out(`mutation: baseline: running \`${c.command}\``);
      const t0 = Date.now();
      const result = await runCommandAsync(c.command, { cwd: store.root, timeoutMs, tailLines: TAIL }).result;
      if (classify(result) === "passed") {
        out(`mutation: baseline: \`${c.command}\` passed after ${seconds(Date.now() - t0)}`);
        ran.push({ command: c, outcome: "passed" });
        continue;
      }
      // A timeout is no answer about the code, so it gets no receipt.
      if (!result.timedOut) ran.push({ command: c, outcome: "failed" });
      red = { command: c.command, result };
      break;
    }
    // R2 again: what the baseline saw must be what the revert starts from.
    const head1 = headSha(store);
    if (head1 !== head0) {
      return refuse(out, `HEAD moved during the baseline, from ${short(head0)} to ${head1 === null ? "nothing git can read" : short(head1)}`, "run it again once nothing else commits; no receipt was recorded and nothing was changed");
    }
    const again = refusals(store, state, item, running);
    if (again !== null) return refuse(out, `after the baseline: ${again.message}`, `${again.fix}; no receipt was recorded`);
    const k1 = mutationKey(store, from);
    if (k1.key !== k0.key) {
      const changed = keyChanges(k0, k1);
      return refuse(
        out,
        `the code and test files changed during the baseline${changed.length > 0 ? `: ${some(changed)}` : k1.key === null ? `: ${k1.reason}` : ""}`,
        "run it again once nothing else writes to them; a file the commands generate belongs in .gitignore; no receipt was recorded and nothing was changed",
      );
    }
    // One fingerprint, taken after the last command, as `gate --full` does.
    const tree = treeId(store);
    for (const { command, outcome } of ran) record(store, { target: command.target, sha: head0, command: command.command, outcome, tree });
    if (red !== null) {
      recordMutation(store, { target: item.slug, sha: head0, command: joined, outcome: "mutation-blocked", tree: `mutation:${k0.key}` });
      if (red.result.timedOut) {
        out(`mutation-blocked: the baseline timed out after ${bound(timeoutMs)}: \`${red.command}\`; nothing was reverted`);
        return 2;
      }
      printTail(out, red.command, red.result.tail);
      out(`mutation-blocked: the baseline is red: \`${red.command}\` ${said(red.result, timeoutMs)} with the change in place, so a kill would say nothing; nothing was reverted`);
      return 2;
    }
  }

  const prepared = prepareRun(store, from, set);
  if (!prepared.ok) {
    return refuse(out, prepared.reason, prepared.path === null ? "nothing was changed; clear the cause and run it again" : "make that content readable (the filter runnable, the object fetched) and run it again; nothing was changed");
  }
  const lock = prepared.lock;
  // prepareRun reads HEAD itself, after the set above was computed from it.
  if (lock.head !== head0) {
    discard(store, lock.run);
    return refuse(out, `HEAD moved from ${short(head0)} to ${short(lock.head)} while the run was staged`, "run it again once nothing else commits; nothing was changed");
  }
  step("prepared");
  const got = acquireLock(store, lock);
  if (!got.ok) {
    discard(store, lock.run);
    return refuse(out, got.reason, "nothing was changed; 'mstack gate' says whether that run is running");
  }
  out(`mutation: lock ${lockPath(store) ?? ""}, run ${lock.run}`);
  out(`mutation: if this process dies: ${restoreCommand(lock.cli)}`);
  out("mutation: until the run ends, save nothing to the files it reverts: a save in the moment one is put back is lost");
  step("lock-written");
  sweepStale(store, lock);

  let ending: Ending;
  let entries: readonly number[] | undefined;
  try {
    out(`mutation: reverting ${lock.entries.length} file(s)`);
    const reverted = applyRevert(store, lock, step);
    if (!reverted.ok) {
      entries = reverted.written;
      ending = { kind: "blocked", reason: `the revert stopped at ${reverted.path}: ${reverted.reason}; no command ran` };
    } else {
      ending = { kind: "survived" };
      for (const c of commands) {
        out(`mutation: running \`${c.command}\` on the reverted tree`);
        const t0 = Date.now();
        const handle = runCommandAsync(c.command, { cwd: store.root, timeoutMs, tailLines: TAIL });
        step("obligations-running");
        const result = await handle.result;
        out(`mutation: \`${c.command}\` ${said(result, timeoutMs)} after ${seconds(Date.now() - t0)}`);
        const verdict = classify(result);
        if (verdict === "passed") continue;
        ending = { kind: verdict === "failed" ? "killed" : "blocked", command: c.command, result };
        break;
      }
    }
  } catch (error) {
    ending = { kind: "blocked", reason: `the run stopped: ${errorText(error)}` };
  }

  const restored = restore(store, lock, entries, step);
  reportRestore(out, restored);
  if (restored.failed.length > 0) {
    out(`mutation: the lock stays; once each path above is cleared: ${restoreCommand(lock.cli)}`);
    return 3;
  }
  out(`mutation: restored ${restored.restored}, tree verified, lock removed`);

  const k1 = mutationKey(store, from);
  const outcome: MutationOutcome = ending.kind === "killed" ? "mutation-killed" : ending.kind === "survived" ? "mutation-survived" : "mutation-blocked";
  if (k1.key === null) {
    out(`mutation: no row was written: ${k1.reason}`);
  } else {
    recordMutation(store, { target: item.slug, sha: lock.head, command: joined, outcome, tree: `mutation:${k1.key}` });
  }
  switch (ending.kind) {
    case "killed":
      printTail(out, ending.command, ending.result.tail);
      out(`mutation-killed: \`${ending.command}\` failed without the change (${said(ending.result, timeoutMs)}; a build failure and an assertion failure look the same here)`);
      return 0;
    case "survived":
      out(`mutation-survived: \`${joined}\` passed without the change; nothing noticed the revert of ${lock.entries.map((e) => e.path).join(", ")}`);
      return 1;
    case "blocked":
      if ("result" in ending) {
        printTail(out, ending.command, ending.result.tail);
        out(`mutation-blocked: \`${ending.command}\` ${said(ending.result, timeoutMs)} on the reverted tree, so it says nothing about the change`);
      } else {
        out(`mutation-blocked: ${ending.reason}`);
      }
      return 2;
  }
}
