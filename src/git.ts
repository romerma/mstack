import { execFileSync } from "node:child_process";

import type { Store } from "./paths.ts";

/**
 * The one place this repository shells out to git.
 *
 * Split out of `src/gate.ts` when `src/verification.ts` needed it too: the gate
 * imports the verification module, so the verification module cannot import the
 * gate. The alternative was a second `execFileSync` with its own timeout and its
 * own environment hardening, which is the duplicate-that-drifts shape
 * `lint-plugin` exists to catch elsewhere.
 */

/**
 * Every caller treats a git failure as "no answer", so a hang has to become one
 * too. Without a timeout a slow or prompting git blocked the status line
 * indefinitely, on the one path that runs on every assistant message. Five
 * seconds is far past any local plumbing command and still finite.
 */
const GIT_TIMEOUT_MS = 5_000;

export interface GitOptions {
  /**
   * Keep the output exactly as git wrote it.
   *
   * Most callers want a single value with the newline gone, so trimming is the
   * default. The exception is output that is *data* rather than an answer:
   * `diff HEAD`, whose bytes are hashed into the tree fingerprint, and where
   * trimming content before hashing it is wrong in principle.
   *
   * Stated at the rung it deserves, because the first version of this comment
   * asserted more than had been checked. **No current behaviour distinguishes
   * it**, measured rather than assumed: both sides of every comparison call this
   * same function, so the trimmed diff hashes just as consistently, and JS
   * `trim()` does not treat NUL as whitespace, so `ls-files -z` is byte-identical
   * either way. A mutation dropping this option survives the suite, and it is an
   * equivalent mutant rather than a coverage gap.
   *
   * It was introduced for a case that no longer exists, and that reason is worth
   * keeping: `status --porcelain` is two status characters, a space, then the
   * path, and either status character may be a space — so trimming the buffer ate
   * the leading space of the *first line only*, and a column parse silently
   * returned `rc/app.ts` for ` M src/app.ts`. That is the kind of bug that passes
   * every fixture with two dirty files and fails with one. Nothing parses
   * porcelain columns now; `treeId` hashes content instead.
   */
  readonly raw?: boolean;
  /**
   * Feed this to git on stdin.
   *
   * One caller: `git hash-object --stdin-paths`, which is how the tree
   * fingerprint reads the content of untracked files. Passing those paths as
   * argv instead would work until a repository had enough untracked files to
   * exceed `ARG_MAX`, and that limit is exactly the kind that holds in every
   * test and fails on somebody's machine.
   */
  readonly stdin?: string;
}

export function git(store: Store, args: readonly string[], options: GitOptions = {}): string | null {
  try {
    const out = execFileSync("git", args, {
      cwd: store.root,
      encoding: "utf8",
      stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "ignore"],
      ...(options.stdin === undefined ? {} : { input: options.stdin }),
      timeout: GIT_TIMEOUT_MS,
      // A git that stops to ask for credentials never returns on its own.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    });
    return options.raw === true ? out : out.trim();
  } catch {
    return null;
  }
}
