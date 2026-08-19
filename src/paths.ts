import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const STORE_DIR = ".mstack";

export interface Store {
  /** Project root: the directory that owns `.mstack/`. */
  readonly root: string;
  readonly dir: string;
  readonly state: string;
  readonly ledger: string;
  readonly decisions: string;
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
