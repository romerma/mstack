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
   * Every other caller wants a single value with the newline gone, so trimming
   * is the default. `status --porcelain` is the exception and it is not a
   * stylistic one: its format is two status characters, a space, then the path,
   * and either status character may itself be a space. Trimming the buffer eats
   * the leading space of the first line, so ` M src/app.ts` arrives as
   * `M src/app.ts` and the path parse silently returns `rc/app.ts` — for the
   * first line only, which is the kind of bug that passes every test with two
   * changed files and fails with one.
   */
  readonly raw?: boolean;
}

export function git(store: Store, args: readonly string[], options: GitOptions = {}): string | null {
  try {
    const out = execFileSync("git", args, {
      cwd: store.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: GIT_TIMEOUT_MS,
      // A git that stops to ask for credentials never returns on its own.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    });
    return options.raw === true ? out : out.trim();
  } catch {
    return null;
  }
}
