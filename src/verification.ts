import { createHash } from "node:crypto";
import { lstatSync, readlinkSync, type Stats } from "node:fs";
import { join } from "node:path";

import { git } from "./git.ts";
import type { Store } from "./paths.ts";
import { append, cell, readRecords } from "./tsv.ts";
import type { Item, State } from "./state.ts";

/**
 * Receipts: which verification command actually ran, against what, and how it
 * went.
 *
 * The gap this closes is the one the `Stop` hook could not see. The fast gate
 * touches only the store and the workspace, so `state.verify` and
 * `item.verification` were executed by nothing but a human typing `mstack gate
 * --full`. In one real session an item's `verification` was a non-executable
 * string from intake — half command, half prose — and it stayed red for 230
 * minutes across four agent passes. Nothing noticed, because nothing ran it, and
 * `sh -n` accepts that string. **The only thing that catches a non-executable
 * verification is running it.**
 *
 * So `gate --full` records what it ran here, and the fast gate reads that record
 * back. The split is what keeps the cost bounded: the hook that fires at the end
 * of every turn reads one small TSV, and the thing that takes minutes still only
 * happens when somebody asks for it.
 *
 * Not the ledger, deliberately. A ledger row is a *verdict* by a pass that
 * looked at the work; a receipt is a *fact* about one command exiting. Writing
 * these into `ledger.tsv` would hand them a verifier column that
 * `canCloseAnItem` accepts, so running `gate --full` would close the item — the
 * exact self-closing shape `checkClosedItems` exists to refuse.
 *
 * ## Concurrency, stated rather than implied away
 *
 * `record` appends without `withLock`, unlike `decisions.add`, so it shares
 * `ensureHeader`'s check-then-write window with `ledger.record`, which calls the
 * same helper the same way. Locking one of the two would leave the codebase
 * inconsistent about a race present in both. Review probed it with eight
 * concurrent `gate --full` runs against a store with no receipt file and lost
 * nothing, 8 rows of 8, so this stops at rung 3: a walked window, not an
 * observed loss. Losing a row is fail-closed — the gate then demands a re-run.
 */

export const HEADER = ["target", "sha", "command", "outcome", "ts", "tree"] as const;

export type Outcome = "passed" | "failed";

/** The `target` a project-level `verify` command is recorded under. */
export const PROJECT_TARGET = "(project)";

/** `tree` for a working tree with nothing uncommitted outside the store. */
export const CLEAN_TREE = "clean";

/**
 * `tree` when git could not be asked, or could not be asked unambiguously.
 *
 * Both sides compute it identically, so a receipt written under this value is
 * satisfied by a check under it — which means the tree half is *off*. That is
 * why `checkVerificationRuns` warns whenever it sees this: the one value that
 * disables half the key must not be the one value nothing mentions.
 */
export const UNKNOWN_TREE = "unknown";

/**
 * Every `.mstack/` in the repository, excluded from the fingerprint.
 *
 * `:(top)` anchors the positive side to the repository root rather than to the
 * process's cwd, so a store in a subdirectory still fingerprints the whole
 * project; `**​/.mstack/**` with `glob` then removes every store, this one and
 * any nested one, because a store's churn is no more "code the verification
 * could execute" than this one's. Verified against both a root and a nested
 * store, from both directories.
 */
const OUTSIDE_THE_STORE = ["--", ":(top)", ":(exclude,top,glob)**/.mstack/**"] as const;

export interface Receipt {
  readonly target: string;
  readonly sha: string;
  readonly command: string;
  readonly outcome: Outcome;
  readonly ts: string;
  /** Fingerprint of the working tree the run happened against. */
  readonly tree: string;
}

/** One command `gate --full` is obliged to run, and who it belongs to. */
export interface Obligation {
  readonly command: string;
  readonly target: string;
}

/**
 * Every command `mstack gate --full` would run for this state.
 *
 * One function, two callers: the half that *runs* the commands and the half
 * that *checks* they ran. Computing the list twice would let the check demand a
 * command `--full` never runs, which is a gate nobody can turn green.
 *
 * Deduplicated on exact text, because a project `verify` and an item's
 * `verification` are often the same command, and running a suite twice to
 * satisfy two obligations that resolve to one receipt is pure cost. Exact text
 * only: `npm test` and `npm  test` are the same command to a shell, and this
 * function is not a shell.
 */
export function obligations(state: State, item: Item | undefined): Obligation[] {
  const out: Obligation[] = [];
  const seen = new Set<string>();
  const add = (command: string, target: string) => {
    const trimmed = command.trim();
    if (trimmed === "" || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push({ command: trimmed, target });
  };
  add(state.verify ?? "", PROJECT_TARGET);
  if (item !== undefined) add(item.verification ?? "", item.slug);
  return out;
}

/**
 * A fingerprint of the **contents** of everything uncommitted, outside the store.
 *
 * ## Why the tree is in the key at all
 *
 * The receipt was once keyed to `(sha, command)` alone, which certified a
 * *commit* and not a *tree*: a green `gate --full`, then an uncommitted edit that
 * broke the very command, then a close — all at exit 0, with the verification red
 * the whole time. The dirty-tree warning is a uniquely weak backstop against
 * that, because `state set --status done` writes `state.json` itself, so the tree
 * is dirty at close by construction and the warning carries no signal.
 *
 * ## Why contents, and not the list of dirty paths
 *
 * The first version of this hashed `git status --porcelain`. A porcelain line is
 * two status characters and a path, so it fingerprints *which paths are dirty*,
 * not what is in them — and if the tree was already dirty when `--full` ran,
 * which is the ordinary mid-session state, every further edit confined to those
 * same paths was invisible. The same green-gate-on-a-red-verification, one layer
 * in, and the code and the docs asserted the guarantee it did not provide.
 *
 * So this reads content:
 *
 * - `git diff HEAD` covers every tracked path — modified, staged, deleted, mode
 *   changed — as content rather than as a status letter.
 * - Untracked, non-ignored files are not in that diff, so their contents are
 *   hashed separately and paired with their paths. Without this, an untracked
 *   `check.sh` edited after a green run would be the same hole again.
 * - Ignored files are in neither, deliberately: build output is not the project.
 * - Tracked files that match HEAD appear nowhere, because `sha` already covers
 *   them.
 *
 * Measured against the alternative before choosing it, on a synthetic 30k-file
 * repository with 500 modified and 200 untracked files: `git diff HEAD` 58ms and
 * the untracked hashing 34ms, against 638ms for a temp-index
 * `read-tree`/`add -A`/`write-tree`, which is equally complete but twelve times
 * the cost and writes loose objects into `.git` as a side effect of a read-only
 * check. This runs on the `Stop` hook inside the `verifying` window, so an order
 * of magnitude matters here.
 *
 * ## What is excluded, and why that is what makes it usable
 *
 * Every `.mstack/`, this one and any nested one. Every session writes
 * `state.json`, `current.md` and this very file while an item is open; a
 * fingerprint that counted those would void a run because someone appended a line
 * to their own progress notes, which is a red gate for a normal mid-session state
 * — the thing that gets a hook switched off.
 *
 * `CLEAN_TREE` rather than a hash for the common case, because a human reading
 * `verification.tsv` should be able to see at a glance that a run happened
 * against committed state.
 *
 * ## Nothing here is read through a symlink, and nothing but a regular file is read
 *
 * `git hash-object` **follows** symlinks and hashes the target's bytes. Git's own
 * index does not: it records a symlink blob as the *target string*. Measured side
 * by side, `git add` on a link to `/etc/passwd` recorded `3594e94c`, the hash of
 * the eleven characters, and not `1fcfce02`, the hash of the file. Following the
 * link was wrong four ways at once, and all four were an ordinary untracked
 * symlink — made, not yet committed, not yet ignored:
 *
 * - a link to a **directory** or a **dangling** link cannot be hashed at all, so
 *   `hash-object` failed and the whole tree half switched itself off. That closed
 *   a real item green on a verification exiting 1.
 * - a link to a **file outside the repository** hashed bytes that are not part of
 *   this project, on a code path that runs at the end of every turn.
 * - a link to **`/dev/zero`** read until the five-second git timeout, twice per
 *   gate.
 *
 * So each untracked path is `lstat`-ed once and classified, and only a regular
 * file is ever opened. The `/dev/zero` row is the tell that this is not really
 * about symlinks: a fifo or a device node sitting in the worktree blocks
 * `hash-object` the same way with no link involved, so the classification is by
 * file kind rather than by the one spelling review happened to find.
 *
 * A path that disappears between the listing and the stat gets its own marker
 * rather than an `UNKNOWN_TREE`. The tree really did change, so changing the
 * fingerprint — voiding the receipt and asking for a re-run — is the true answer;
 * switching the key off over an ordinary transient is the answer this round is
 * about removing.
 */
export function treeId(store: Store): string {
  // `--full-index` because for a binary file the abbreviated `index` line is the
  // *entire* content signal, and seven hex characters is a smaller space than
  // anything else in this key. Free, and it removes the question rather than
  // answering it.
  const diff = git(store, ["diff", "HEAD", "--full-index", ...OUTSIDE_THE_STORE], { raw: true });
  if (diff === null) return UNKNOWN_TREE;

  // `-z` because this list is read, not displayed: without it git quotes any
  // path with a special character in it, and a quoted path is not the path.
  //
  // `--full-name` because `ls-files` prints paths relative to the *current
  // directory* while `hash-object --stdin-paths` resolves them relative to the
  // *repository root*. For a store in a subdirectory those disagree,
  // `hash-object` fails outright, and every run in that store fingerprinted as
  // `unknown` — the same silent switch-off as the symlink rows, reachable by
  // nothing more exotic than where the store sits.
  const listed = git(
    store,
    ["ls-files", "-o", "--exclude-standard", "-z", "--full-name", ...OUTSIDE_THE_STORE],
    { raw: true },
  );
  if (listed === null) return UNKNOWN_TREE;
  const untracked = listed.split("\0").filter((path) => path !== "");

  if (diff === "" && untracked.length === 0) return CLEAN_TREE;

  const parts: string[] = [];
  if (untracked.length > 0) {
    // Paths are repo-root-relative now, so they are resolved against the top
    // level and not against the store, which may be a subdirectory of it.
    const top = git(store, ["rev-parse", "--show-toplevel"]);
    if (top === null) return UNKNOWN_TREE;

    const readable: string[] = [];
    for (const path of untracked) {
      const token = classify(join(top, path));
      if (token === null) readable.push(path);
      else parts.push(`${path}\0${token}`);
    }

    if (readable.length > 0) {
      // `git hash-object --stdin-paths` is newline-separated and has no `-z`
      // form, so a filename containing a newline cannot be handed to it
      // unambiguously. Hashing the rest and calling the result a tree
      // fingerprint would be a partial answer wearing a complete answer's name,
      // which is the defect this whole module exists to close.
      if (readable.some((path) => path.includes("\n"))) return UNKNOWN_TREE;
      const out = git(store, ["hash-object", "--stdin-paths"], { stdin: `${readable.join("\n")}\n` });
      if (out === null) return UNKNOWN_TREE;
      const hashes = out.split("\n").filter((line) => line !== "");
      // One hash per path or the pairing below is a lie.
      if (hashes.length !== readable.length) return UNKNOWN_TREE;
      readable.forEach((path, i) => parts.push(`${path}\0blob:${hashes[i]}`));
    }
  }

  // Paths as well as contents: two empty untracked files hash identically, and
  // which of them exists is part of the state a verification runs against.
  return createHash("sha256")
    .update(`${diff}\0${parts.sort().join("\0")}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * What this entry contributes to the fingerprint, or `null` to read its bytes.
 *
 * Only a regular file returns `null`; everything else describes itself without
 * being opened. That is the invariant, and it is stated as one because the
 * reasoning I first wrote for it was wrong and measurement said so.
 *
 * I justified this as closing a class — "a fifo or a device node in the worktree
 * would block `hash-object` the same way with no symlink involved". It would
 * not, because git never offers one: `git ls-files -o` lists **regular files and
 * symlinks only**, and silently passes over a fifo, a socket or a device node.
 * A `mkfifo` in the worktree appears in neither `ls-files -o` nor
 * `status --porcelain`. The five-second `/dev/zero` stall only ever reached
 * `hash-object` *through* a symlink.
 *
 * So the final branch is unreachable through today's `ls-files`, and it stays
 * anyway — as one line rather than four. It costs nothing and it makes the safe
 * behaviour the *default* for anything that is not a regular file, instead of
 * something each new entry kind would have to be remembered for.
 */
function classify(absolute: string): string | null {
  let stat: Stats;
  try {
    stat = lstatSync(absolute);
  } catch {
    // Listed a moment ago and not there now. A distinct token rather than
    // `UNKNOWN_TREE`: the tree changed, so the honest result is a different
    // fingerprint that voids the receipt, not a key that stops checking.
    return "gone";
  }
  if (stat.isSymbolicLink()) {
    try {
      // The target *string*, which is exactly what git stores for a symlink —
      // never the target's contents, and never a read through the link.
      return `symlink:${readlinkSync(absolute)}`;
    } catch {
      return "symlink:unreadable";
    }
  }
  return stat.isFile() ? null : "not-a-regular-file";
}

/**
 * `ts` is overridable for the same reason `ledger.record`'s is, and with the
 * same signature: a test that pins ordering needs to say when a row happened.
 */
export function record(store: Store, receipt: Omit<Receipt, "ts"> & { ts?: string }): Receipt {
  const full: Receipt = { ...receipt, ts: receipt.ts ?? new Date().toISOString() };
  append(store.verification, HEADER, [
    full.target,
    full.sha,
    full.command,
    full.outcome,
    full.ts,
    full.tree,
  ]);
  return full;
}

export function receipts(store: Store): Receipt[] {
  return readRecords(store.verification)
    .filter((r) => r["outcome"] === "passed" || r["outcome"] === "failed")
    .map((r) => ({
      target: r["target"] ?? "",
      sha: r["sha"] ?? "",
      command: r["command"] ?? "",
      outcome: r["outcome"] as Outcome,
      ts: r["ts"] ?? "",
      tree: r["tree"] ?? "",
    }));
}

/**
 * The last time this exact command ran at this exact commit and tree, if ever.
 *
 * Last rather than best, and the difference is the whole point: a command that
 * passed and was then re-run red is red. `check` reads the rows in file order,
 * which is append order.
 *
 * Matched on the command *text*, not on the item. The incident this module
 * exists for was a `verification` field that did not execute; keying a receipt
 * to `(item, sha)` alone would let a green run of the old string vouch for a
 * string edited afterwards. Both sides go through `cell` so the comparison sees
 * what was actually stored.
 */
function lastRun(
  rows: readonly Receipt[],
  command: string,
  sha: string,
  tree: string | undefined,
): Receipt | undefined {
  const needle = cell(command);
  let found: Receipt | undefined;
  for (const row of rows) {
    if (row.sha !== sha || cell(row.command) !== needle) continue;
    if (tree !== undefined && row.tree !== tree) continue;
    found = row;
  }
  return found;
}

export interface RunStatus {
  readonly required: readonly Obligation[];
  /** Every required command has a passing run here. Vacuously true when none is required. */
  readonly satisfied: boolean;
  /** One line per command that is not proven green here. Empty when satisfied. */
  readonly problems: readonly string[];
}

/**
 * @param tree the fingerprint to judge against, when the caller already has one.
 *
 * Threaded rather than recomputed, because the fast gate needs it twice — once
 * to warn that it is `unknown`, once to match receipts — and computing it twice
 * doubled the whole content-hashing cost on the path that runs at the end of
 * every turn. It is also why a `/dev/zero` link cost ten seconds a gate rather
 * than five: two timeouts, not one.
 */
export function status(
  store: Store,
  state: State,
  item: Item | undefined,
  sha: string,
  tree: string = treeId(store),
): RunStatus {
  const required = obligations(state, item);
  if (required.length === 0) return { required, satisfied: true, problems: [] };

  const rows = receipts(store);
  const problems: string[] = [];
  for (const { command } of required) {
    const here = lastRun(rows, command, sha, tree);
    if (here?.outcome === "passed") continue;
    if (here?.outcome === "failed") {
      problems.push(`\`${command}\` ran at ${short(sha)} and failed`);
      continue;
    }
    problems.push(`\`${command}\` ${why(rows, command, sha)}`);
  }
  return { required, satisfied: problems.length === 0, problems };
}

/**
 * Why this command is not proven here — and never collapsed into one message.
 *
 * "Never ran", "ran at another commit", "ran against another working tree" and
 * "ran before receipts tracked the tree at all" are four different facts, and a
 * reader acts on each of them differently.
 */
function why(rows: readonly Receipt[], command: string, sha: string): string {
  const atSha = lastRun(rows, command, sha, undefined);
  if (atSha !== undefined) {
    // "Uncommitted files have changed since" and not "a different working
    // tree": the sentence a user reads has to describe what was compared. While
    // this hashed porcelain lines it said "it does not vouch for the files as
    // they are now" and vouched only for which files were dirty, which is the
    // message telling a reader it checked something it had not.
    return atSha.tree === ""
      ? `last ran at ${short(sha)} before receipts recorded the working tree, so it cannot vouch for one`
      : `last ran at ${short(sha)}, and an uncommitted file has changed since`;
  }
  const needle = cell(command);
  const elsewhere = rows.filter((row) => cell(row.command) === needle);
  return elsewhere.length > 0
    ? `has not run at ${short(sha)}; ${elsewhere.length} earlier run(s) exist at other commits, and a new commit voids them`
    : "has never been executed";
}

function short(sha: string): string {
  return sha.slice(0, 8);
}
