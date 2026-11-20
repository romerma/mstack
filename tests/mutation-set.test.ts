import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { mutationKey, revertSet } from "../src/mutation.ts";
import { storeAt, type Store } from "../src/paths.ts";
import { setup } from "../src/setup.ts";
import { measureStart } from "../src/size.ts";
import { captured, sandbox, type Sandbox } from "./helpers.ts";
import { SPAWN_TEST } from "./mutation-fixture.ts";
/**
 * Item 42, task 1.1: what the mutation check reverts (the revert set) and what
 * its receipt is keyed by (the key). Both read git and the working tree and
 * write nothing, so every test builds a throwaway repository and asks.
 */

function withBox(body: (box: Sandbox) => void): void {
  const box = sandbox();
  try {
    body(box);
  } finally {
    box.dispose();
  }
}

const git = (root: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function put(root: string, rel: string, content: string, mode?: number): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (mode !== undefined) chmodSync(file, mode);
}

function commitAll(root: string, message: string): string {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function commitPaths(root: string, message: string, ...paths: string[]): string {
  git(root, "add", "--", ...paths);
  git(root, "commit", "-q", "-m", message, "--", ...paths);
  return git(root, "rev-parse", "HEAD");
}

/** A store in `sub` of the sandbox's repository, as `mstack setup` run in a monorepo package gives. */
function subStore(box: Sandbox, sub: string): Store {
  const root = join(box.store.root, sub);
  mkdirSync(root, { recursive: true });
  captured(() => setup(root));
  return storeAt(root);
}

function setPaths(store: Store, start: string): string[] {
  const set = revertSet(store, start);
  assert.ok(set !== null, "git could not answer");
  return set.entries.map((e) => e.path).sort();
}

function keyOf(store: Store, start: string): string {
  const k = mutationKey(store, start);
  assert.ok(k.key !== null, `the key is null: ${"reason" in k ? k.reason : ""}`);
  return k.key;
}

const ZERO = "0".repeat(40);

test("R10 tests, docs and the store are not in the revert set", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    put(root, "tests/a.test.ts", "t\n");
    put(root, "docs/x.md", "d\n");
    put(root, "README.md", "r\n");
    const start = commitAll(root, "start");
    put(root, "src/a.ts", "a2\n");
    put(root, "tests/a.test.ts", "t2\n");
    put(root, "docs/x.md", "d2\n");
    put(root, "README.md", "r2\n");
    writeFileSync(box.store.state, `${readFileSync(box.store.state, "utf8")}\n`);
    put(root, ".mstack/notes.txt", "a store file the classifier would call code\n");
    commitAll(root, "the item");
    assert.deepEqual(setPaths(box.store, start), ["src/a.ts"]);
  });
});

test("R10 a store in a subdirectory reverts only under its root", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "pkg/app/src/x.ts", "x\n");
    put(root, "other/lib.ts", "o\n");
    const start = commitAll(root, "start");
    const store = subStore(box, "pkg/app");
    put(root, "pkg/app/src/x.ts", "x2\n");
    put(root, "pkg/app/src/new.ts", "n\n");
    put(root, "other/lib.ts", "o2\n");
    commitAll(root, "the item, with the sub store's own files");
    assert.deepEqual(setPaths(store, start), ["src/new.ts", "src/x.ts"]);
  });
});

test("R10 an untracked code file is not in the revert set", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    const start = commitAll(root, "start");
    put(root, "src/a.ts", "a2\n");
    const head = commitAll(root, "the item");
    put(root, "src/wip.ts", "work in progress\n");
    assert.deepEqual(setPaths(box.store, start), ["src/a.ts"]);
    assert.deepEqual(setPaths(box.store, head), [], "only untracked code differs from HEAD");
  });
});

test("R9 the revert set records each path's start and HEAD mode and blob", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/mod.ts", "m1\n");
    put(root, "src/del.ts", "d\n");
    put(root, "src/run.sh", "#!/bin/sh\n", 0o644);
    const start = commitAll(root, "start");
    put(root, "src/mod.ts", "m2\n");
    rmSync(join(root, "src/del.ts"));
    put(root, "src/new.ts", "n\n");
    chmodSync(join(root, "src/run.sh"), 0o755);
    commitAll(root, "the item");
    const blob = (rev: string, path: string): string => git(root, "rev-parse", `${rev}:${path}`);
    const set = revertSet(box.store, start);
    assert.ok(set !== null);
    const byPath = new Map(set.entries.map((e) => [e.path, { ...e }]));
    assert.deepEqual(byPath.get("src/mod.ts"), {
      path: "src/mod.ts",
      startMode: "100644",
      startBlob: blob(start, "src/mod.ts"),
      headMode: "100644",
      headBlob: blob("HEAD", "src/mod.ts"),
    });
    assert.deepEqual(byPath.get("src/del.ts"), {
      path: "src/del.ts",
      startMode: "100644",
      startBlob: blob(start, "src/del.ts"),
      headMode: "000000",
      headBlob: ZERO,
    });
    assert.deepEqual(byPath.get("src/new.ts"), {
      path: "src/new.ts",
      startMode: "000000",
      startBlob: ZERO,
      headMode: "100644",
      headBlob: blob("HEAD", "src/new.ts"),
    });
    assert.deepEqual(byPath.get("src/run.sh"), {
      path: "src/run.sh",
      startMode: "100644",
      startBlob: blob(start, "src/run.sh"),
      headMode: "100755",
      headBlob: blob(start, "src/run.sh"),
    });
    assert.equal(byPath.size, 4);
  });
});

test("R21 a code or test edit changes the key, committed or not", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    put(root, "tests/a.test.ts", "t\n");
    const start = commitAll(root, "start");
    const k0 = keyOf(box.store, start);
    put(root, "src/a.ts", "a2\n");
    const k1 = keyOf(box.store, start);
    assert.notEqual(k1, k0, "an uncommitted code edit");
    commitAll(root, "commit it");
    assert.equal(keyOf(box.store, start), k1, "committing the same content is the same key");
    put(root, "tests/a.test.ts", "t2\n");
    commitAll(root, "a committed test edit");
    const k2 = keyOf(box.store, start);
    assert.notEqual(k2, k1, "a committed test edit");
    put(root, "tests/a.test.ts", "t3\n");
    assert.notEqual(keyOf(box.store, start), k2, "an uncommitted test edit");
  });
});

test("R21 a new code or test file changes the key", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    const start = commitAll(root, "start");
    const k0 = keyOf(box.store, start);
    put(root, "src/new.ts", "n\n");
    const k1 = keyOf(box.store, start);
    assert.notEqual(k1, k0, "an untracked code file");
    put(root, "tests/new.test.ts", "t\n");
    const k2 = keyOf(box.store, start);
    assert.notEqual(k2, k1, "an untracked test file");
    put(root, "src/c.ts", "c\n");
    commitPaths(root, "a committed code file", "src/c.ts");
    assert.notEqual(keyOf(box.store, start), k2, "a committed code file");
  });
});

test("R21 committing an untracked test file changes the key", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    const start = commitAll(root, "start");
    put(root, "tests/x.test.ts", "t\n");
    const before = keyOf(box.store, start);
    commitPaths(root, "commit the test", "tests/x.test.ts");
    assert.notEqual(keyOf(box.store, start), before);
  });
});

test("R21 an executable bit changes the key", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/run.sh", "#!/bin/sh\n", 0o644);
    const start = commitAll(root, "start");
    const k0 = keyOf(box.store, start);
    chmodSync(join(root, "src/run.sh"), 0o755);
    const k1 = keyOf(box.store, start);
    assert.notEqual(k1, k0, "a tracked code file made executable");
    put(root, "src/u.sh", "#!/bin/sh\n", 0o644);
    const k2 = keyOf(box.store, start);
    chmodSync(join(root, "src/u.sh"), 0o755);
    assert.notEqual(keyOf(box.store, start), k2, "an untracked code file made executable");
  });
});

test("R21 a docs or store commit does not change the key", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    const start = commitAll(root, "start");
    put(root, "src/a.ts", "a2\n");
    const k0 = keyOf(box.store, start);
    put(root, "docs/x.md", "d\n");
    commitPaths(root, "docs", "docs/x.md");
    assert.equal(keyOf(box.store, start), k0, "a docs commit");
    writeFileSync(box.store.state, `${readFileSync(box.store.state, "utf8")}\n`);
    put(root, ".mstack/notes.txt", "n\n");
    commitPaths(root, "store", ".mstack");
    assert.equal(keyOf(box.store, start), k0, "a store commit");
    put(root, "README.md", "uncommitted doc\n");
    put(root, ".mstack/progress/more.md", "uncommitted store file\n");
    assert.equal(keyOf(box.store, start), k0, "an uncommitted doc and store file");
  });
});

test("R21 a rebase that changes no code or test path keeps the key", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    git(root, "branch", "-M", "main");
    put(root, "src/a.ts", "a\n");
    put(root, "tests/a.test.ts", "t\n");
    commitAll(root, "on main");
    git(root, "checkout", "-q", "-b", "feat/x");
    const base = git(root, "rev-parse", "HEAD");
    put(root, "src/a.ts", "a2\n");
    const before = commitAll(root, "the item");
    const startBefore = measureStart(box.store, base).from;
    assert.ok(startBefore !== null);
    const k0 = keyOf(box.store, startBefore);
    git(root, "checkout", "-q", "main");
    put(root, "docs/x.md", "d\n");
    commitAll(root, "docs on main");
    git(root, "checkout", "-q", "feat/x");
    git(root, "rebase", "-q", "main");
    assert.notEqual(git(root, "rev-parse", "HEAD"), before, "the rebase rewrote the item's commit");
    const startAfter = measureStart(box.store, base).from;
    assert.ok(startAfter !== null);
    assert.notEqual(startAfter, startBefore, "the start moved with main");
    assert.equal(keyOf(box.store, startAfter), k0);
  });
});

test("R21 a store in a subdirectory has a key that a test edit changes", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "pkg/app/src/x.ts", "x\n");
    const start = commitAll(root, "start");
    const store = subStore(box, "pkg/app");
    put(root, "pkg/app/src/x.ts", "x2\n");
    put(root, "pkg/app/tests/x.test.ts", "t\n");
    const k = keyOf(store, start);
    put(root, "pkg/app/tests/x.test.ts", "t2\n");
    assert.notEqual(keyOf(store, start), k);
  });
});

test("R21 a key path that holds a newline makes the key null, with its reason", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    const start = commitAll(root, "start");
    put(root, "tests/odd\nname.test.ts", "t\n");
    const k = mutationKey(box.store, start);
    assert.equal(k.key, null);
    assert.match("reason" in k ? k.reason : "", /tests\/odd\\nname\.test\.ts.*newline/);
  });
});

test("R21 the key is null, with its reason, when git cannot list the changed or the untracked files", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    const start = commitAll(root, "start");
    put(root, "src/a.ts", "a2\n");
    put(root, "tests/new.test.ts", "t\n");
    keyOf(box.store, start);
    // A git on PATH that fails one subcommand and runs the real git for every other.
    const real = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    const bin = join(root, ".git", "mstack-fake-bin");
    mkdirSync(bin);
    const saved = process.env["PATH"];
    try {
      for (const failing of ["diff", "ls-files"]) {
        writeFileSync(join(bin, "git"), `#!/bin/sh\nif [ "$1" = ${failing} ]; then exit 1; fi\nexec '${real}' "$@"\n`);
        chmodSync(join(bin, "git"), 0o755);
        process.env["PATH"] = `${bin}:${saved ?? ""}`;
        const k = mutationKey(box.store, start);
        process.env["PATH"] = saved;
        assert.equal(k.key, null, `git ${failing} failed and the key is ${JSON.stringify(k)}`);
        assert.match("reason" in k ? k.reason : "", /git could not list/);
      }
    } finally {
      process.env["PATH"] = saved;
    }
  });
});

test("R21 a key path whose name is not UTF-8 makes the key null, with its reason", SPAWN_TEST, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/a.ts", "a\n");
    commitAll(root, "a");
    // A name this volume may refuse to hold, so it is built in the index alone: tracked at the start, absent from the tree.
    const sha = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: root, input: "x\n", encoding: "utf8" }).trim();
    const name = Buffer.concat([Buffer.from("src/caf"), Buffer.from([0xff]), Buffer.from(".ts")]);
    execFileSync("git", ["-c", "core.precomposeunicode=false", "update-index", "--index-info"], { cwd: root, input: Buffer.concat([Buffer.from(`100644 ${sha}\t`), name, Buffer.from("\n")]) });
    git(root, "commit", "-q", "-m", "a name that is not UTF-8");
    const start = git(root, "rev-parse", "HEAD");
    assert.match(execFileSync("git", ["diff", "--name-only", "-z", start, "--"], { cwd: root, encoding: "latin1" }), /src\/caf\xff\.ts/, "the path is not in the key set, so this test proves nothing");
    const k = mutationKey(box.store, start);
    assert.equal(k.key, null, JSON.stringify(k));
    assert.match("reason" in k ? k.reason : "", /src\/caf.*not UTF-8/);
  });
});
