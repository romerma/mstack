import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The one runtime import that keeps this file from being a leaf module.
// git.ts imports only `type Store` back, which both runtimes erase, so there
// is no cycle at runtime — pinned by the suite running green under bun and
// node rather than asserted.
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
    const manifest = join(root, ".claude-plugin", "plugin.json");
    // Only a regular file is read at all. The catch below turns throws into
    // silence, but a blocking read is not a throw: `readFileSync` on a fifo —
    // or a stalled network mount — hangs with no timeout, on paths that run
    // every turn (`runGate` on the Stop hook) and on every Bash call
    // (`warnForeignCli` via `hook pre-tool-use`). src/git.ts makes the same
    // call for the same reason with its 5-second timeout: a hang has to
    // become "no answer".
    if (!statSync(manifest).isFile()) return false;
    const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown };
    return parsed.name === "mstack";
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
 * The repository behind `dir` and the src tree it has committed: the canonical
 * git common dir plus the object id of `HEAD:src`, or nulls where git has no
 * answer.
 *
 * `--git-common-dir` rather than `--git-dir`, because worktrees are the point:
 * every worktree of one repository answers with the same common dir, while
 * `--git-dir` answers with each worktree's private one. The common-dir output
 * is relative (`.git`) when asked from a main checkout's root, so it is
 * absolutised before canonicalising rather than trusting git's formatting.
 *
 * `HEAD:src` rides in the *same spawn*, which is what makes comparing code
 * affordable at all: git returns its already-stored tree object id, nothing is
 * hashed, and the reviewer's 20-run means put the combined form at 22.4ms
 * against 19.8ms for the common dir alone. The round-2 decision row priced
 * this as "a full src tree hash into the Stop hook" and was wrong; the
 * superseding row says so. The fallback spawn exists because rev-parse fails
 * the whole command when `HEAD:src` cannot resolve (no commits yet, or no
 * committed src/), and losing the common-dir answer with it would turn "same
 * repository, tree unknown" into "foreign".
 *
 * The limit that stays open: `HEAD:src` is the *committed* tree. Uncommitted
 * edits to src/ are invisible to it, and src/ is dirty for most of a working
 * session. Callers must not present tree equality as stronger than that.
 */
interface RepoIdentity {
  readonly commonDir: string | null;
  readonly srcTree: string | null;
}

function repoIdentity(dir: string): RepoIdentity {
  const combined = git(storeAt(dir), ["rev-parse", "--git-common-dir", "HEAD:src"]);
  if (combined !== null) {
    const [commonDir, srcTree] = combined.split("\n");
    if (commonDir !== undefined && commonDir !== "" && srcTree !== undefined && srcTree !== "") {
      return { commonDir: canonical(isAbsolute(commonDir) ? commonDir : join(dir, commonDir)), srcTree };
    }
  }
  const alone = git(storeAt(dir), ["rev-parse", "--git-common-dir"]);
  if (alone === null || alone === "") return { commonDir: null, srcTree: null };
  return { commonDir: canonical(isAbsolute(alone) ? alone : join(dir, alone)), srcTree: null };
}

/**
 * Where the running CLI stands relative to a store, answered once for every
 * caller — the gate says it loudly, `warnForeignCli` quietly, and both must
 * agree or the two surfaces drift.
 */
export type Provenance =
  /** The store root is not an mstack checkout; in a user's repo the plugin CLI is supposed to be foreign, so there is nothing to say. */
  | { readonly kind: "not-a-checkout" }
  /** The running copy is the store root's own. */
  | { readonly kind: "own" }
  /** Same repository, different root: a worktree sibling. `sameSrc` is committed-tree equality, `null` tree ids mean git had no answer to compare. */
  | {
      readonly kind: "same-repo";
      readonly running: string;
      readonly sameSrc: boolean;
      readonly storeSrc: string | null;
      readonly runningSrc: string | null;
    }
  /** Outside the repository: the installed cache, a separate clone, any copy whose green is not this code's green. */
  | { readonly kind: "foreign"; readonly running: string };

/**
 * This exists because `which -a mstack` resolves to the installed plugin
 * cache, so inside the mstack checkout the habit-formed `mstack gate` runs a
 * copy that predates the code under review and reports on checks it does not
 * contain. The loud failure mode of that mismatch is an unknown flag; the
 * silent one is a green gate over a store the checkout's own gate calls red,
 * reproduced before this function existed.
 *
 * The question this answers is "is the code producing this report the code
 * this store expects?", and it takes two comparisons because one is not
 * enough either way. Outside the repository — different or absent common dir
 * — is unambiguously wrong: round one established that. Inside the
 * repository, sameness of path was round one's rule (red for every worktree,
 * on byte-identical code, every turn — a hook people switch off) and sameness
 * of repository alone was round two's (a worktree branch that adds a gate
 * check reported green through the main checkout's binary, with an
 * affirmative ok line — the item's originating defect printed by the fix).
 * So: same repository is necessary, and the committed src tree is the
 * sufficiency test.
 *
 * Cost, stated precisely because round two's comment here was measurably
 * wrong: the identity spawns run once per invocation where the two roots
 * differ — which includes every worktree run, on every gate — and never in a
 * user's repo or on the path-equal path. One spawn per root, `HEAD:src`
 * riding along with the common dir.
 */
export function cliProvenance(store: Store, running: string = runningCliRoot()): Provenance {
  if (!isMstackCheckout(store.root)) return { kind: "not-a-checkout" };
  if (canonical(running) === canonical(store.root)) return { kind: "own" };
  const mine = repoIdentity(store.root);
  const theirs = repoIdentity(running);
  if (mine.commonDir === null || theirs.commonDir === null || mine.commonDir !== theirs.commonDir) {
    return { kind: "foreign", running };
  }
  return {
    kind: "same-repo",
    running,
    sameSrc: mine.srcTree !== null && mine.srcTree === theirs.srcTree,
    storeSrc: mine.srcTree,
    runningSrc: theirs.srcTree,
  };
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
