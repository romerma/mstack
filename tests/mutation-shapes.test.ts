import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { refusals, type Refusal } from "../src/mutation.ts";
import type { Item, State } from "../src/state.ts";
import { item, sandbox, state, type Sandbox } from "./helpers.ts";
import { SPAWN_TEST } from "./mutation-fixture.ts";
/**
 * Item 42, task 1.3: the shapes R3 refuses and the merges R4 refuses, before
 * anything is touched. A commit that a case-insensitive checkout cannot hold is
 * built in the index with `git update-index --index-info` and committed, so
 * these run the same on every filesystem.
 */

const ZERO = "0".repeat(40);

const git = (root: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

/** git with the filesystem's Unicode folding off, so the index holds the exact bytes given. */
const exact = (root: string, args: string[], input?: Buffer): string =>
  execFileSync("git", ["-c", "core.precomposeunicode=false", ...args], { cwd: root, encoding: "utf8", ...(input === undefined ? {} : { input }) }).trim();

function put(root: string, rel: string, content: string): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function commitAll(root: string, message: string): string {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

const blob = (root: string, content: string): string =>
  execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: root, input: content, encoding: "utf8" }).trim();

/**
 * Commit index changes given as `{ path, mode, sha }`, a mode of `0` removing
 * the path, through `update-index --index-info` (`-z` when a path holds a
 * newline). The working tree is not touched.
 */
function indexCommit(root: string, message: string, changes: { path: string | Buffer; mode: string; sha: string }[]): string {
  const z = changes.some((c) => (typeof c.path === "string" ? c.path : c.path.toString("latin1")).includes("\n"));
  const input = Buffer.concat(
    changes.map((c) => Buffer.concat([Buffer.from(`${c.mode} ${c.sha}\t`), typeof c.path === "string" ? Buffer.from(c.path) : c.path, Buffer.from(z ? "\0" : "\n")])),
  );
  exact(root, ["update-index", ...(z ? ["-z"] : []), "--index-info"], input);
  exact(root, ["commit", "-q", "-m", message]);
  return git(root, "rev-parse", "HEAD");
}

function active(base: string): { st: State; it: Item } {
  const it = item({ status: "in_progress", base }) as unknown as Item;
  return { st: state([it], { verify: "true" }) as State, it };
}

function withBox(body: (box: Sandbox) => void): void {
  const box = sandbox();
  try {
    body(box);
  } finally {
    box.dispose();
  }
}

/** The store committed, `src/a.ts` with it: the start of every case here. */
function started(box: Sandbox): string {
  put(box.store.root, "src/a.ts", "a\n");
  return commitAll(box.store.root, "start");
}

function refusedWith(r: Refusal | null, ...patterns: RegExp[]): void {
  assert.ok(r !== null, `expected a refusal matching ${patterns.join(", ")}, got none`);
  for (const p of patterns) assert.match(`${r.message}\n${r.fix}`, p);
}

function refuse(box: Sandbox, base: string): Refusal | null {
  const { st, it } = active(base);
  // Not the sandbox: R5 is not the subject here.
  return refusals(box.store, st, it, "/nonexistent-mstack-copy");
}

// ------------------------------------------------------------------ R3

test("R3 a symlink in the set", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    mkdirSync(join(root, "src"), { recursive: true });
    symlinkSync("a", join(root, "src/link.ts"));
    const start = started(box);
    unlinkSync(join(root, "src/link.ts"));
    symlinkSync("b", join(root, "src/link.ts"));
    commitAll(root, "the item retargets the link");
    refusedWith(refuse(box, start), /src\/link\.ts/, /not a regular file/);
  });
});

test("R3 a submodule in the set", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    const start = started(box);
    indexCommit(root, "the item adds a submodule", [{ path: "vendor/sub", mode: "160000", sha: start }]);
    refusedWith(refuse(box, start), /vendor\/sub/, /not a regular file/);
  });
});

test("R3 a file that became a directory", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/x", "x\n");
    put(root, "src/z", "z\n");
    const start = started(box);
    rmSync(join(root, "src/x"));
    rmSync(join(root, "src/z"));
    put(root, "src/x/a.ts", "a\n");
    put(root, "src/z/z.test.ts", "only a test\n");
    commitAll(root, "the item turns two files into directories");
    refusedWith(refuse(box, start), /src\/x\b/, /src\/z\b/, /a file on one side and a directory on the other/);
  });
});

test("R3 a directory that became a file, its other files tests", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/y/b.test.ts", "t\n");
    const start = started(box);
    rmSync(join(root, "src/y"), { recursive: true });
    put(root, "src/y", "now a file\n");
    commitAll(root, "the item turns a directory of tests into a file");
    refusedWith(refuse(box, start), /src\/y\b/, /a file on one side and a directory on the other/);
  });
});

test("R3 a case-only rename", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/Foo.ts", "foo\n");
    const start = started(box);
    const sha = git(root, "rev-parse", "HEAD:src/Foo.ts");
    const sharp = blob(root, "sharp s\n");
    const withSharp = indexCommit(root, "a capital sharp s", [{ path: "src/ẞ.ts", mode: "100644", sha: sharp }]);
    indexCommit(root, "the item renames by case", [
      { path: "src/Foo.ts", mode: "0", sha: ZERO },
      { path: "src/foo.ts", mode: "100644", sha },
      // One name on a case-insensitive APFS volume; upper-then-lower case alone keeps them apart.
      { path: "src/ẞ.ts", mode: "0", sha: ZERO },
      { path: "src/ss.ts", mode: "100644", sha: sharp },
    ]);
    assert.notEqual(withSharp, start);
    refusedWith(refuse(box, start), /src\/Foo\.ts/, /src\/foo\.ts/, /case or Unicode normalisation/);
    // From the commit that added it, so the capital sharp s is a path of the set on one side.
    refusedWith(refuse(box, withSharp), /src\/ẞ\.ts/, /src\/ss\.ts/, /case or Unicode normalisation/);
  });
});

test("R3 a normalisation-only rename", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    const start = started(box);
    const nfc = "src/café.ts";
    const nfd = "src/café.ts";
    const sha = blob(root, "caf\n");
    const withNfc = indexCommit(root, "an NFC name", [{ path: nfc, mode: "100644", sha }]);
    indexCommit(root, "the item renames it to NFD", [
      { path: nfc, mode: "0", sha: ZERO },
      { path: nfd, mode: "100644", sha },
    ]);
    assert.notEqual(withNfc, start);
    refusedWith(refuse(box, withNfc), new RegExp(nfc), new RegExp(nfd), /case or Unicode normalisation/);
  });
});

test("R3 parent directories that differ only by case", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/Lib/a.ts", "a\n");
    const start = started(box);
    indexCommit(root, "the item moves code to src/lib", [
      { path: "src/Lib/a.ts", mode: "0", sha: ZERO },
      { path: "src/lib/b.ts", mode: "100644", sha: blob(root, "b\n") },
    ]);
    refusedWith(refuse(box, start), /src\/Lib\b/, /src\/lib\b/, /case or Unicode normalisation/);
  });
});

test("R3 plain added, deleted, modified and renamed files are not refused", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/old.ts", "old\n");
    put(root, "src/b.ts", "b\n");
    put(root, "src/lib/deep.ts", "deep\n");
    const start = started(box);
    put(root, "src/new.ts", "new\n");
    rmSync(join(root, "src/old.ts"));
    put(root, "src/a.ts", "a2\n");
    renameSync(join(root, "src/b.ts"), join(root, "src/c.ts"));
    put(root, "src/lib/deeper/more.ts", "more\n");
    commitAll(root, "the item, plain files only");
    assert.equal(refuse(box, start), null);
  });
});

test("R3 a name with a newline, and one that is not UTF-8", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    const start = started(box);
    const sha = blob(root, "n\n");
    indexCommit(root, "the item adds two names this tool cannot write", [
      { path: "src/a\nb.ts", mode: "100644", sha },
      { path: Buffer.concat([Buffer.from("src/caf"), Buffer.from([0xff]), Buffer.from(".ts")]), mode: "100644", sha },
    ]);
    refusedWith(refuse(box, start), /src\/a\\nb\.ts/, /a name that holds a newline/, /src\/caf/, /a name that is not UTF-8/);
  });
});

// ------------------------------------------------------------------ R4

/** `main` with one commit past the sandbox's first, checked out; returns that commit. */
function onMain(box: Sandbox): string {
  git(box.store.root, "branch", "-M", "main");
  return started(box);
}

test("R4 main merged in after a base on the branch", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    onMain(box);
    git(root, "checkout", "-q", "-b", "feat/x");
    put(root, "src/item.ts", "the item\n");
    const base = commitAll(root, "the item's first commit, recorded as its base");
    put(root, "src/item.ts", "the item, more\n");
    commitAll(root, "the item");
    git(root, "checkout", "-q", "main");
    put(root, "src/other.ts", "someone else's work\n");
    const other = commitAll(root, "other work on main");
    git(root, "checkout", "-q", "feat/x");
    git(root, "merge", "-q", "--no-ff", "--no-edit", "main");
    const merge = git(root, "rev-parse", "HEAD");
    refusedWith(refuse(box, base), new RegExp(merge.slice(0, 8)), new RegExp(other.slice(0, 8)), /not the item's/, /rebase/, /--base <commit>/);
  });
});

test("R4 a sibling branch merged in after a fork-point start", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    const base = git(root, "rev-parse", "HEAD");
    const fork = onMain(box);
    git(root, "checkout", "-q", "-b", "feat/x");
    put(root, "src/item.ts", "the item\n");
    commitAll(root, "the item");
    git(root, "checkout", "-q", "-b", "feat/sibling", "main");
    put(root, "src/sibling.ts", "a sibling's work\n");
    const sibling = commitAll(root, "the sibling");
    git(root, "checkout", "-q", "feat/x");
    git(root, "merge", "-q", "--no-ff", "--no-edit", "feat/sibling");
    const merge = git(root, "rev-parse", "HEAD");
    assert.notEqual(base, fork, "the base is older than the fork point, so the start is the fork point");
    refusedWith(refuse(box, base), new RegExp(merge.slice(0, 8)), new RegExp(sibling.slice(0, 8)), /not the item's/);
  });
});

test("R4 main merged in after a fork-point start is not refused", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    const base = git(root, "rev-parse", "HEAD");
    onMain(box);
    git(root, "checkout", "-q", "-b", "feat/x");
    put(root, "src/item.ts", "the item\n");
    commitAll(root, "the item");
    git(root, "checkout", "-q", "main");
    put(root, "src/other.ts", "other work\n");
    commitAll(root, "other work on main");
    git(root, "checkout", "-q", "feat/x");
    git(root, "merge", "-q", "--no-ff", "--no-edit", "main");
    assert.equal(refuse(box, base), null);
  });
});

test("R4 a rebased branch is not refused", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    const base = git(root, "rev-parse", "HEAD");
    onMain(box);
    git(root, "checkout", "-q", "-b", "feat/x");
    put(root, "src/item.ts", "the item\n");
    commitAll(root, "the item");
    git(root, "checkout", "-q", "main");
    put(root, "src/other.ts", "other work\n");
    commitAll(root, "other work on main");
    git(root, "checkout", "-q", "feat/x");
    git(root, "rebase", "-q", "main");
    assert.equal(refuse(box, base), null);
  });
});
