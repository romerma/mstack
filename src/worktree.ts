import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { defaultBranch, git } from "./gate.ts";
import { UserError, type Store } from "./paths.ts";

/**
 * Worktree tooling, which enxvo documents but never shipped: `git worktree
 * list` there shows seventeen worktrees, twelve of them merged and never
 * cleaned up. Creating one is cheap; noticing that thirty of them are dead is
 * not, so prune is the half that actually earns its place.
 */

export interface WorktreeInfo {
  readonly path: string;
  readonly branch: string;
  readonly sha: string;
  readonly isMain: boolean;
  readonly merged: boolean;
  readonly dirty: boolean;
}

export function list(store: Store): WorktreeInfo[] {
  const raw = git(store, ["worktree", "list", "--porcelain"]);
  if (raw === null) throw new UserError("not a git repository");

  const dflt = defaultBranch(store);
  const mergedBranches = new Set(
    (git(store, ["branch", "--merged", dflt, "--format=%(refname:short)"]) ?? "")
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b !== ""),
  );

  const infos: WorktreeInfo[] = [];
  let path = "";
  let sha = "";
  let branch = "";
  const flush = () => {
    if (path === "") return;
    const short = branch.replace(/^refs\/heads\//, "");
    infos.push({
      path,
      branch: short,
      sha,
      isMain: infos.length === 0,
      merged: short !== dflt && mergedBranches.has(short),
      dirty: isDirty(path),
    });
    path = "";
    sha = "";
    branch = "";
  };
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      flush();
      path = line.slice("worktree ".length);
    } else if (line.startsWith("HEAD ")) sha = line.slice("HEAD ".length);
    else if (line.startsWith("branch ")) branch = line.slice("branch ".length);
  }
  flush();
  return infos;
}

/**
 * Anything here that would not survive `git worktree remove`.
 *
 * `--ignored` is the load-bearing flag. `git status --porcelain` excludes
 * everything in `.gitignore` by definition, so a worktree holding a `.env` and
 * a `build/` reported clean and `prune --yes` deleted it. Those files are
 * exactly the ones with no copy anywhere else.
 *
 * A worktree we cannot inspect counts as dirty. Guessing wrong in that
 * direction leaves a directory behind; guessing wrong in the other deletes
 * someone's credentials.
 */
function isDirty(path: string): boolean {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--ignored=matching"], {
      cwd: path,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    });
    return out.trim() !== "";
  } catch {
    return true;
  }
}

export interface CreateResult {
  readonly path: string;
  readonly branch: string;
  readonly base: string;
  readonly baseSha: string;
}

/**
 * Create `<repo>-wt-<slug>` beside the repo, on a fresh branch off the base.
 *
 * The base SHA comes back so the caller can write it into `current.md`. A
 * checkpoint that says "branched from origin/main" without the SHA is not a
 * checkpoint, because origin/main moved.
 */
export function create(
  store: Store,
  slug: string,
  options: { prefix?: string; base?: string } = {},
): CreateResult {
  const repo = basename(store.root);
  const path = resolve(join(dirname(store.root), `${repo}-wt-${slug}`));
  if (existsSync(path)) throw new UserError(`${path} already exists`, "pick another slug, or prune it");

  const base = options.base ?? `origin/${defaultBranch(store)}`;
  const baseSha = git(store, ["rev-parse", base]) ?? git(store, ["rev-parse", "HEAD"]);
  if (baseSha === null) throw new UserError(`cannot resolve ${base}`);

  const branch = `${options.prefix ?? "feat"}/${slug}`;
  run(store, ["worktree", "add", "-b", branch, path, base]);
  return { path, branch, base, baseSha };
}

export interface PruneCandidate {
  readonly info: WorktreeInfo;
  readonly reason: string;
}

/** Worktrees whose branch is merged and which hold no uncommitted or ignored work. */
export function prunable(store: Store): PruneCandidate[] {
  // Never the one the caller is standing in. `git worktree remove` refuses it,
  // but only after the candidate has been listed and, with --yes, agreed to —
  // so it was offered as safe to delete.
  const here = resolve(process.cwd());
  return list(store)
    .filter((w) => !w.isMain && w.merged && !w.dirty && !isInside(here, w.path))
    .map((info) => ({ info, reason: `${info.branch} is merged into the default branch` }));
}

function isInside(candidate: string, directory: string): boolean {
  const root = resolve(directory);
  return candidate === root || candidate.startsWith(`${root}/`);
}

export function remove(store: Store, path: string): void {
  run(store, ["worktree", "remove", path]);
}

function run(store: Store, args: readonly string[]): string {
  try {
    return execFileSync("git", args, { cwd: store.root, encoding: "utf8" }).trim();
  } catch (error) {
    throw new UserError(`git ${args.join(" ")} failed`, (error as Error).message.split("\n")[0]);
  }
}
