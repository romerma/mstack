import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { git } from "./git.ts";

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
 * The identity is the plugin manifest: `.claude-plugin/plugin.json` parsing
 * with `"name": "mstack"`. It is tracked, so every clone and every `git
 * worktree` carries it, and no unrelated project does. Round one keyed on the
 * two file markers alone, and that fired on an ordinary repository that
 * happened to carry a `bin/mstack` wrapper and its own `src/cli.ts` — where
 * the failure's `fix:` line named the very command that had just produced it,
 * a loop with no flag or setting to break. In every ordinary project the
 * plugin CLI is *supposed* to be foreign to the store, so the only safe
 * failure direction here is silence: a manifest that is missing, unreadable,
 * unparseable or differently named all read as "not a checkout". mstack's own
 * manifest going bad is `lint-plugin`'s problem, not a stranger's.
 *
 * The launcher and source markers stay required on top, because the failure
 * this function arms tells the reader to run `<root>/bin/mstack` — the remedy
 * has to exist before the check may point at it.
 */
export function isMstackCheckout(root: string): boolean {
  if (!existsSync(join(root, "bin", "mstack")) || !existsSync(join(root, "src", "cli.ts"))) return false;
  try {
    const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8")) as {
      name?: unknown;
    };
    return manifest.name === "mstack";
  } catch {
    return false;
  }
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
 * The repository behind `dir`: its canonical git common dir, or null when git
 * has no answer there.
 *
 * `--git-common-dir` rather than `--git-dir`, because worktrees are the point:
 * every worktree of one repository answers with the same common dir, while
 * `--git-dir` answers with each worktree's private one. The output is relative
 * (`.git`) when asked from a main checkout's root, so it is absolutised before
 * canonicalising rather than trusting git's formatting — `--path-format` would
 * do that server-side but sets a git version floor this repository has not
 * needed to set.
 */
function gitCommonDir(dir: string): string | null {
  const out = git(storeAt(dir), ["rev-parse", "--git-common-dir"]);
  if (out === null || out === "") return null;
  return canonical(isAbsolute(out) ? out : join(dir, out));
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
 *
 * Foreign means *outside this repository*, not merely at another path. A `git
 * worktree` of this repo shares its common dir, and the hooks run whatever
 * `${CLAUDE_PLUGIN_ROOT}/bin/mstack` the session was launched with — a path a
 * contributor cannot redirect per worktree — so round one's path-only rule
 * turned every orchestrate-style worktree session red on byte-identical code,
 * every turn, which is a hook people switch off. The cost of the common-dir
 * rule is stated in its decision row: a worktree at a *different* commit runs
 * different code and is accepted silently. That is bounded — worktrees are
 * created from, merged into and pruned by this same repository — while the
 * installed cache is not a git repository at all and a separate clone answers
 * with a different common dir, so both stay foreign, at any commit.
 *
 * The common dirs are only consulted after the cheap comparisons disagree, so
 * the two extra git spawns are paid exactly once per actually-foreign run and
 * never in a user's repo or on the agreeing path.
 */
export function foreignCliRoot(store: Store, running: string = runningCliRoot()): string | null {
  if (!isMstackCheckout(store.root)) return null;
  if (canonical(running) === canonical(store.root)) return null;
  const own = gitCommonDir(store.root);
  if (own !== null && own === gitCommonDir(running)) return null;
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
