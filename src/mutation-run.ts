import { constants } from "node:os";

import { git, headSha } from "./git.ts";
import { isActive } from "./lifecycle.ts";
import { mutationKey, refusals, revertSet, trackedChanges, type MutationKey } from "./mutation.ts";
import {
  acquireLock, BY_HAND, discard, FOR_A_PERSON, errorText, inLockStore, liveness, lockPath, placeOf, prepareRun, readLock, restoreCommand, shellWord, sweepStale, validateLock, type Lock,
} from "./mutation-lock.ts";
import { applyRevert, entryAt, holds, restoreFromLock, type Entry, type Restored } from "./mutation-tree.ts";
import { runningCliRoot, type Store } from "./paths.ts";
import { runCommandAsync, type Running, type RunResult } from "./run.ts";
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

/** A restore's last line: "lock removed" only when it removed this run's lock, not when the one at its name was gone or another run's. */
const restoredLine = (restored: Restored): string =>
  `mutation: restored ${restored.restored}, tree verified${restored.lockRemoved ? ", lock removed" : "; no lock of this run's was at its name, so none was removed"}`;

/** R18 (a): the lock's paths that do not hold the start's content by exact name (where the start lacks one, something resolves there). */
function pathsNotAtStart(root: string, lock: Lock): string[] {
  const listings = new Map<string, string[]>();
  return lock.entries
    .filter((e) => {
      try {
        const at = entryAt(root, e.path, listings);
        return e.start === null ? !(at.kind === "absent" && at.variant === null) : !holds(at, e.start);
      } catch {
        return true;
      }
    })
    .map((e) => e.path);
}

/** R18 (c): what is at the lock's name, when it is not this run's lock. */
function lockNotOurs(store: Store, lock: Lock): string | null {
  const held = readLock(store);
  if (held === null) return "the lock file was gone";
  if ("damaged" in held) return "the lock file was replaced by one that cannot be read";
  return held.lock.run === lock.run ? null : `the lock file names another run, ${String(held.lock.run)}`;
}

const changedLine = (held: readonly string[]): string => `mutation-blocked: the tree changed under the run, so no row was written: ${held.join("; ")}`;

/** R19: HEAD moved during the run; how to put it back, as the user's option, with the working tree kept. */
function headMoved(store: Store, lock: Lock, now: string): string[] {
  const lines = [`mutation: HEAD moved during the run, from ${short(lock.head)} to ${short(now)}`];
  const branch = git(store, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const reset = `git reset ${lock.head} moves ${lock.branch ?? "it"} back and keeps the working tree (the commit stays in the reflog)`;
  if (lock.branch === null) {
    lines.push(`mutation: to put HEAD back where the run found it: git switch --detach ${lock.head}`);
  } else if (branch === lock.branch) {
    lines.push(`mutation: if you want it: ${reset}`);
  } else {
    const tip = git(store, ["rev-parse", "--verify", "--quiet", `refs/heads/${lock.branch}`]);
    lines.push(`mutation: HEAD is ${branch === null ? "detached" : `on ${branch}`}, not on ${lock.branch}: git switch ${lock.branch} first${tip === lock.head ? "" : `, then, if you want it: ${reset}`}`);
  }
  return lines;
}

/** The untracked entries that are not ignored, outside every store directory, relative to the top; null when git cannot answer. */
function untrackedNow(store: Store): Set<string> | null {
  const out = git(store, ["ls-files", "--others", "--exclude-standard", "-z", "--full-name", "--", ":(top)", ":(exclude,top,glob)**/.mstack/**"], { raw: true });
  return out === null ? null : new Set(out.split("\0").filter((p) => p !== ""));
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
    return { restored: 0, rescued: [], left: [], failed: [{ path: ".", reason: `the restore stopped: ${errorText(error)}`, fix: "clear the cause" }], lockRemoved: false };
  }
}

const SIGNALS = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1 } as const;
type Caught = keyof typeof SIGNALS;

/** The first signal that reached the run, and the command running on its behalf. */
interface Control {
  caught: Caught | null;
  current: Running | null;
}

const immediate = (): Promise<void> => new Promise((res) => setImmediate(res));

/**
 * A signal that arrived during a synchronous section has run its handler
 * after this. Two `setImmediate`s, not one: under node, a section that began
 * in the poll phase (the continuation of a child's close event) gets its first
 * immediate in the same turn of the loop, before the next poll reads the
 * signal; the second comes after that poll. Bun needs one.
 */
const tick = async (): Promise<void> => {
  await immediate();
  await immediate();
};

/**
 * The run. SIGINT, SIGTERM and SIGHUP never end the process while it runs:
 * the handlers record the first and stop the command that is running, and
 * the run acts on it at its next check, after the restore and its proof when
 * the lock is held (R16, R17). Returns the exit code.
 */
export async function runMutation(store: Store, options: MutationOptions): Promise<number> {
  const ctl: Control = { caught: null, current: null };
  const handlers = (Object.keys(SIGNALS) as Caught[]).map((name) => {
    const handler = (): void => {
      if (ctl.caught === null) ctl.caught = name;
      ctl.current?.stop();
    };
    process.on(name, handler);
    return [name, handler] as const;
  });
  try {
    return await run(store, options, ctl);
  } finally {
    for (const [name, handler] of handlers) process.off(name, handler);
  }
}

async function run(store: Store, options: MutationOptions, ctl: Control): Promise<number> {
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
  const stopped = (): number => {
    const name = ctl.caught as Caught;
    out(`mutation: stopped by ${name}, so nothing was recorded`);
    return 128 + SIGNALS[name];
  };
  // A Ctrl-C to the group also kills the git child a check was waiting on, which reads as git failing: the signal comes first.
  const refused = async (message: string, fix: string): Promise<number> => {
    await tick();
    return ctl.caught !== null ? stopped() : refuse(out, message, fix);
  };

  let state: State;
  try {
    state = parseState(store.state);
  } catch (error) {
    return refused(`the store's state cannot be read: ${errorText(error)}`, "'mstack gate' says what is wrong with it");
  }
  const found = state.items.find((i) => isActive(i.status));
  const why = refusals(store, state, found, running);
  if (why !== null) return refused(why.message, why.fix);
  // The refusals passed, so the item, its base and its start resolve.
  const item = found as Item;
  const start = measureStart(store, resolveCommit(store, item.base as string) as string);
  const from = start.from as string;
  const set = revertSet(store, from);
  const head0 = headSha(store);
  if (set === null || head0 === null) return refused(`git could not list the code changed since ${short(from)}`, "run it again; if it persists, check 'git status'");
  const k0 = mutationKey(store, from);
  if (k0.key === null) return refused(`no receipt could be keyed: ${k0.reason}`, "nothing was changed; the receipt is keyed by the code and test files, so such a name cannot be checked");
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
      await tick();
      if (ctl.caught !== null) return stopped();
      out(`mutation: baseline: running \`${c.command}\``);
      const t0 = Date.now();
      ctl.current = runCommandAsync(c.command, { cwd: store.root, timeoutMs, tailLines: TAIL });
      const result = await ctl.current.result;
      ctl.current = null;
      // Stopped by the handler, or ended while a signal was in: no receipt for it, nor for the others.
      if (ctl.caught !== null) return stopped();
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
      return refused(`HEAD moved during the baseline, from ${short(head0)} to ${head1 === null ? "nothing git can read" : short(head1)}`, "run it again once nothing else commits; no receipt was recorded and nothing was changed");
    }
    const again = refusals(store, state, item, running);
    if (again !== null) return refused(`after the baseline: ${again.message}`, `${again.fix}; no receipt was recorded`);
    const k1 = mutationKey(store, from);
    if (k1.key !== k0.key) {
      const changed = keyChanges(k0, k1);
      return refused(
        `the code and test files changed during the baseline${changed.length > 0 ? `: ${some(changed)}` : k1.key === null ? `: ${k1.reason}` : ""}`,
        "run it again once nothing else writes to them; a file the commands generate belongs in .gitignore; no receipt was recorded and nothing was changed",
      );
    }
    // One fingerprint, taken after the last command, as `gate --full` does.
    const tree = treeId(store);
    await tick();
    if (ctl.caught !== null) return stopped();
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

  // What is untracked now: an entry that is new after the run is reported as left in place (R19).
  const untracked0 = untrackedNow(store) ?? new Set<string>();
  const prepared = prepareRun(store, from, set);
  // A Ctrl-C that killed a `git cat-file` child is seen here, after one turn, and is not reported as an unreadable blob.
  await tick();
  if (ctl.caught !== null) {
    if (prepared.ok) discard(store, prepared.lock.run);
    return stopped();
  }
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
  let ending: Ending;
  // What the restore takes: nothing until the revert has begun, then every entry, or after a stopped revert the ones it wrote.
  let entries: readonly number[] | undefined = [];
  let revertDone = false;
  try {
    out(`mutation: lock ${lockPath(store) ?? ""}, run ${lock.run}`);
    out(`mutation: if this process dies: ${restoreCommand(lock.cli)}`);
    out("mutation: until the run ends, save nothing to the files it reverts: a save in the moment one is put back is lost");
    step("lock-written");
    sweepStale(store, lock);
    // A signal that came with the lock, or before it, is acted on before any path is written (R17).
    await tick();
    if (ctl.caught !== null) {
      ending = { kind: "blocked", reason: "stopped before the revert" };
    } else {
      out(`mutation: reverting ${lock.entries.length} file(s)`);
      entries = undefined;
      const reverted = applyRevert(store, lock, step);
      if (!reverted.ok) {
        entries = reverted.written;
        ending = { kind: "blocked", reason: `the revert stopped at ${reverted.path}: ${reverted.reason}; no command ran` };
      } else {
        revertDone = true;
        ending = await reversedRun();
      }
    }
  } catch (error) {
    ending = { kind: "blocked", reason: `the run stopped: ${errorText(error)}` };
  }

  /** Each command on the reverted tree, a signal checked after one turn before each spawn; the first that does not pass ends it. */
  async function reversedRun(): Promise<Ending> {
    for (const c of commands) {
      await tick();
      if (ctl.caught !== null) break;
      out(`mutation: running \`${c.command}\` on the reverted tree`);
      const t0 = Date.now();
      ctl.current = runCommandAsync(c.command, { cwd: store.root, timeoutMs, tailLines: TAIL });
      step("obligations-running");
      const result = await ctl.current.result;
      ctl.current = null;
      if (ctl.caught !== null) break;
      out(`mutation: \`${c.command}\` ${said(result, timeoutMs)} after ${seconds(Date.now() - t0)}`);
      const verdict = classify(result);
      if (verdict === "passed") continue;
      return { kind: verdict === "failed" ? "killed" : "blocked", command: c.command, result };
    }
    return ctl.caught !== null ? { kind: "blocked", reason: "stopped by a signal" } : { kind: "survived" };
  }

  // R18 (a) and (c), read before the restore and with no child process: what the reverted tree holds now, and whose lock is at the name.
  const held: string[] = [];
  const notAtStart = revertDone ? pathsNotAtStart(store.root, lock) : [];
  if (notAtStart.length > 0) held.push(`(a) not at the start's content when the commands ended: ${some(notAtStart)}`);
  const lockSaid = lockNotOurs(store, lock);
  if (lockSaid !== null) held.push(`(c) ${lockSaid}`);

  const restored = restore(store, lock, entries, step);
  reportRestore(out, restored);
  if (restored.failed.length > 0) {
    // R15: the lock is what keeps the tree from being taken for the item's code; a vanished one is written again.
    if (readLock(store) === null) {
      const again = acquireLock(store, lock);
      out(again.ok ? "mutation: the lock file was gone, so it was written again from the run's record" : `mutation: the lock file was gone and could not be written again: ${again.reason}`);
    }
    out(`mutation: the lock stays; once each path above is cleared: ${restoreCommand(lock.cli)}`);
    if (held.length > 0) out(changedLine(held));
    return 3;
  }
  out(restoredLine(restored));

  // The lock is gone, so git may run again: R18 (b), (d) and (e), and the report of R19, which names no cause.
  const head1 = headSha(store);
  if (head1 === null) held.push("(b) git could not read HEAD after the run");
  else if (head1 !== lock.head) {
    held.push(`(b) HEAD is ${short(head1)}, not the lock's ${short(lock.head)}`);
    for (const line of headMoved(store, lock, head1)) out(line);
  }
  const changes = trackedChanges(store);
  if (changes === null) held.push("(d) git could not say whether tracked files changed");
  else if (changes.length > 0) {
    held.push(`(d) differs from HEAD after the restore: ${some(changes.map((c) => (c.staged ? `${c.path} (staged)` : c.path)))}`);
    for (const c of changes) {
      const p = shellWord(c.path);
      out(
        c.staged
          ? `mutation: staged during the run: ${c.path}: git diff --cached -- ${p} shows it, and git restore --staged -- ${p} discards that staged version`
          : `mutation: changed during the run: ${c.path}: git diff -- ${p}`,
      );
    }
  }
  const k1 = mutationKey(store, from);
  if (k1.key === null) held.push(`(e) the key could not be computed after the run: ${k1.reason}`);
  else if (k1.key !== k0.key) {
    const changed = keyChanges(k0, k1);
    const untracked = changed.some((p) => (k1.lines.get(p) ?? k0.lines.get(p) ?? "").split("\0")[1] === "untracked");
    held.push(`(e) the code and test files differ from before the run: ${some(changed)}${untracked ? "; a file that is generated belongs in .gitignore" : ""}`);
  }
  for (const p of [...(untrackedNow(store) ?? [])].filter((x) => !untracked0.has(x)).sort()) {
    out(`mutation: left in place: ${p} (git status --short -- ${shellWord(p)})`);
  }
  // A signal at any point of the run, this report's git calls included: the tree is back, and nothing is recorded (R16).
  await tick();
  if (ctl.caught !== null) return stopped();
  if (held.length > 0) {
    out(changedLine(held));
    return 2;
  }

  const outcome: MutationOutcome = ending.kind === "killed" ? "mutation-killed" : ending.kind === "survived" ? "mutation-survived" : "mutation-blocked";
  recordMutation(store, { target: item.slug, sha: lock.head, command: joined, outcome, tree: `mutation:${k1.key as string}` });
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

const nothingThere = (entry: Entry): boolean => entry.kind === "absent" && entry.variant === null;

/**
 * `mstack verify --restore` (R22 to R24): the tree of a run that is not alive
 * put back from its lock, proved, and the lock removed. Nothing is written for
 * no lock, a lock that is not a run's record, the lock of another store of the
 * worktree, or a run that may be alive.
 * Returns 0 (restored, or nothing to do), 2 (refused) or 3 (not restored).
 */
export function restoreRun(store: Store, options: { readonly out: (line: string) => void }): number {
  const out = (line: string): void => {
    try {
      options.out(line);
    } catch {
      // A closed terminal: the restore goes on.
    }
  };
  // Asked first: the restore runs no child process and reads the git directory this leaves cached.
  const file = lockPath(store);
  if (file === null) {
    out("mutation: nothing to restore: the store is not in a git repository");
    return 0;
  }
  const held = readLock(store);
  if (held === null) {
    out(`mutation: nothing to restore: no lock at ${file}`);
    return 0;
  }
  const byHand = (): void => out(`mutation: ${FOR_A_PERSON}: ${BY_HAND}`);
  if ("damaged" in held) {
    out(`mutation: refused: ${held.damaged}; nothing was written, and the lock stays`);
    byHand();
    return 2;
  }
  // R24 before anything trusts a field: liveness reads the pid, the host and the boot time.
  const problems = validateLock(held.lock);
  if (problems.length > 0) {
    out(`mutation: refused: the lock ${file} is not one a run wrote: ${problems.join("; ")}; nothing was written, and the lock stays`);
    byHand();
    return 2;
  }
  const lock = held.lock;
  // Two stores of one worktree share its lock, and the lock's paths are its own store's: never resolved against another's root.
  const place = placeOf(store);
  if (place === null) return refuse(out, "git could not say where this store is in its worktree, so whose the lock is cannot be told", "run it again; nothing was written");
  if (lock.rootFromTop !== place.rel) {
    const name = (rel: string): string => (rel === "." ? "the worktree's top level" : rel);
    // The `cd` only to a store whose restore takes the lock: a spelling that differs only in case or Unicode form would loop (item 101, A3).
    const way = inLockStore(restoreCommand(lock.cli), place.top, lock.rootFromTop);
    refuse(
      out,
      `the lock is the run's of the store at ${name(lock.rootFromTop)} in this worktree, and this store is at ${name(place.rel)}; nothing was written, and the lock stays`,
      "line" in way ? `run it from that store: ${way.line}` : way.none,
    );
    if ("none" in way) byHand();
    return 2;
  }
  const alive = liveness(lock);
  const said = { running: "running", "not-running": "not running", unknown: "cannot tell whether it is running" }[alive.state];
  out(`mutation: lock from pid ${lock.pid} (${said}: ${alive.reason}), run ${lock.run}, ${lock.entries.length} path(s)`);
  if (alive.state === "running") {
    return refuse(out, `the run that wrote the lock may be alive: pid ${lock.pid} on ${lock.host}, ${alive.reason}`, "wait for it to end: it restores the tree itself; nothing was written");
  }
  if (alive.state === "unknown") {
    refuse(out, `whether the run that wrote the lock is alive cannot be told: pid ${lock.pid} on ${lock.host}, ${alive.reason}`, `run ${restoreCommand(lock.cli)} where it ran, on ${lock.host}; nothing was written`);
    byHand();
    return 2;
  }
  let atHead = 0;
  let atStart = 0;
  for (const e of lock.entries) {
    let at: Entry | null;
    try {
      at = entryAt(store.root, e.path);
    } catch {
      at = null;
    }
    if (at !== null && (e.head === null ? nothingThere(at) : holds(at, e.head))) atHead += 1;
    else if (at !== null && (e.start === null ? nothingThere(at) : holds(at, e.start))) atStart += 1;
  }
  out(`mutation: ${atHead} at HEAD, ${atStart} as the revert wrote them, ${lock.entries.length - atHead - atStart} other`);
  const restored = restore(store, lock, undefined, () => {});
  reportRestore(out, restored);
  if (restored.failed.length > 0) {
    out(`mutation: the lock stays; once each path above is cleared: ${restoreCommand(lock.cli)}`);
    return 3;
  }
  out(restoredLine(restored));
  return 0;
}
