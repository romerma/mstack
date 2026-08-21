import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STORE_DIR = ".mstack";

export interface Store {
  /** Project root: the directory that owns `.mstack/`. */
  readonly root: string;
  readonly dir: string;
  readonly state: string;
  readonly ledger: string;
  readonly decisions: string;
  /**
   * Which verification command ran here, at which commit, and how it went.
   *
   * Machine-local and gitignored (see `setup`), unlike every other file in the
   * store. Committing it would loop — a receipt is keyed to HEAD, and committing
   * one moves HEAD and voids what was just written — and it would let one
   * worktree's run vouch for another's, when the whole point is that somebody
   * here executed the command.
   */
  readonly verification: string;
  readonly progress: string;
  readonly current: string;
  readonly history: string;
  readonly specs: string;
}

export function storeAt(root: string): Store {
  const dir = join(root, STORE_DIR);
  const progress = join(dir, "progress");
  return {
    root,
    dir,
    state: join(dir, "state.json"),
    ledger: join(dir, "ledger.tsv"),
    decisions: join(dir, "decisions.tsv"),
    verification: join(dir, "verification.tsv"),
    progress,
    current: join(progress, "current.md"),
    history: join(progress, "history.md"),
    specs: join(dir, "specs"),
  };
}

/**
 * Walk up from `start` looking for `.mstack/`.
 *
 * The walk stops at the filesystem root, not at a git boundary. A worktree
 * carries its own `.mstack/`, and that per-worktree copy is exactly what makes
 * "one active item" mean one active item *here* rather than one across every
 * checkout on the machine.
 */
export function findStore(start: string = process.cwd()): Store | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, STORE_DIR))) return storeAt(dir);
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The root of the mstack copy whose code is executing right now.
 *
 * Keyed to the module, not to `process.argv`: `import.meta.url` names the file
 * that is actually running whether it was reached through `bin/mstack`, a test
 * runner, or a direct `node src/cli.ts`, and the launcher already hands every
 * runtime an absolute path (bin/mstack resolves `$0` through its symlinks
 * before computing the root). This file lives at `<root>/src/paths.ts`, so the
 * root is two levels up.
 *
 * Deliberately not a version string. Two copies of this plugin both declare
 * "0.1.0" while ten of their twelve src/ files differ and their gates disagree
 * on an exit code, so a version comparison is a check that cannot fail — the
 * `item-17` row in .mstack/decisions.tsv is the record. The path is what
 * actually separates them.
 */
export function runningCliRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Is `root` an mstack checkout — a clone or worktree of this plugin itself?
 *
 * Both markers, on purpose. In every ordinary project the plugin CLI is
 * *supposed* to be foreign to the store, so a check that fired there would be
 * noise about a situation that is correct; a repo has to carry the launcher
 * *and* the source it launches before running some other copy against it
 * becomes the trap worth naming.
 */
export function isMstackCheckout(root: string): boolean {
  return existsSync(join(root, "bin", "mstack")) && existsSync(join(root, "src", "cli.ts"));
}

/**
 * One path, canonicalised for comparison, never for display.
 *
 * `realpathSync` so that macOS's `/tmp` → `/private/tmp` and a symlinked
 * checkout compare equal to themselves; the fallback keeps a deleted or
 * unreadable path comparable instead of throwing out of the middle of a check.
 */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/**
 * The root of the running CLI when it is foreign to a store whose own root is
 * an mstack checkout, and null everywhere else — including every user repo.
 *
 * This exists because `which -a mstack` resolves to the installed plugin
 * cache, so inside the mstack checkout the habit-formed `mstack gate` runs a
 * copy that predates the code under review and reports on checks it does not
 * contain. The loud failure mode of that mismatch is an unknown flag; the
 * silent one is a green gate over a store the checkout's own gate calls red,
 * reproduced before this function existed.
 */
export function foreignCliRoot(store: Store, running: string = runningCliRoot()): string | null {
  if (!isMstackCheckout(store.root)) return null;
  if (canonical(running) === canonical(store.root)) return null;
  return running;
}

/** An error whose message is meant for a human, not a stack trace. */
export class UserError extends Error {
  readonly fix: string | undefined;
  constructor(message: string, fix?: string) {
    super(message);
    this.name = "UserError";
    this.fix = fix;
  }
}

export function requireStore(start?: string): Store {
  const store = findStore(start);
  if (store === null) {
    throw new UserError(
      `no ${STORE_DIR}/ found in this directory or any parent`,
      "run 'mstack setup' to create one",
    );
  }
  return store;
}
