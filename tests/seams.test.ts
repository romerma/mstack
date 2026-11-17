import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseState } from "../src/state.ts";
import { item, sandbox, state } from "./helpers.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function run(cwd: string, args: readonly string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync(BIN, [...args], { cwd, encoding: "utf8", timeout: 60_000 });
  if (result.error !== undefined) throw result.error;
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status ?? 1 };
}

const only = (sb: ReturnType<typeof sandbox>) => parseState(sb.store.state).items[0]!;
const rawOnly = (sb: ReturnType<typeof sandbox>) =>
  (JSON.parse(readFileSync(sb.store.state, "utf8")) as { items: Record<string, unknown>[] }).items[0]!;

const A = "CLI: `mstack state add` exit code and stdout";
const B = "`withLock(file, run, opts)` in src/tsv.ts";

test("state add --seam is repeatable and keeps the order given", () => {
  const sb = sandbox();
  try {
    const added = run(sb.store.root, [
      "state", "add", "--slug", "x-thing", "--title", "X", "--acceptance", "it works", "--seam", A, "--seam", `  ${B}  `,
    ]);
    assert.equal(added.code, 0, added.stderr);
    assert.deepEqual(rawOnly(sb)["seams"], [A, B], "two seams, in order, trimmed");
    assert.deepEqual(only(sb).seams, [A, B]);
  } finally {
    sb.dispose();
  }
});

test("state add without --seam writes no seams key", () => {
  const sb = sandbox();
  try {
    const added = run(sb.store.root, ["state", "add", "--slug", "x-thing", "--title", "X", "--acceptance", "it works"]);
    assert.equal(added.code, 0, added.stderr);
    assert.equal("seams" in rawOnly(sb), false, "an item that names no seam carries no key");
  } finally {
    sb.dispose();
  }
});

test("an empty --seam is refused by both writers and writes nothing", () => {
  const sb = sandbox();
  try {
    for (const blank of ["", "   "]) {
      const added = run(sb.store.root, [
        "state", "add", "--slug", "x-thing", "--title", "X", "--acceptance", "it works", "--seam", blank,
      ]);
      assert.equal(added.code, 2, added.stdout);
      assert.match(added.stderr, /an empty --seam is not a value/);
    }
    assert.equal(parseState(sb.store.state).items.length, 0, "a refused add must not have written the item");

    sb.writeState(state([item({ seams: [A] })]));
    const set = run(sb.store.root, ["state", "set", "1", "--seam", ""]);
    assert.equal(set.code, 2);
    assert.match(set.stderr, /an empty --seam is not a value/);
    assert.match(set.stderr, /--clear seams/, "the refusal names the spelling that works");
    assert.deepEqual(only(sb).seams, [A], "a refused set must not have written anything");
  } finally {
    sb.dispose();
  }
});

test("state set --seam replaces the list, says what it dropped, and counts as an instruction", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ seams: [A, B] })]));
    const set = run(sb.store.root, ["state", "set", "1", "--seam", "the only seam left"]);
    assert.equal(set.code, 0, set.stderr);
    assert.deepEqual(only(sb).seams, ["the only seam left"], "replaced, not appended");
    assert.match(set.stdout, /seams: 2 seam\(s\) replaced with 1/);
    assert.match(set.stdout, /dropped "CLI: `mstack state add` exit code and stdout"/);
    assert.match(set.stdout, /dropped "`withLock\(file, run, opts\)` in src\/tsv\.ts"/);
    assert.match(set.stdout, /added "the only seam left"/, "a replacement names what it added too");
  } finally {
    sb.dispose();
  }
});

test("clearing another field on an item with seams does not report a dropped seam", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ seams: [A, B], source: "issue #4" })]));
    const cleared = run(sb.store.root, ["state", "set", "1", "--clear", "source"]);
    assert.equal(cleared.code, 0, cleared.stderr);
    assert.deepEqual(only(sb).seams, [A, B], "the seams are untouched");
    assert.doesNotMatch(cleared.stdout, /dropped/, "nothing was dropped, so nothing may say so");
  } finally {
    sb.dispose();
  }
});

test("state set --seam on an item with none adds them and prints them", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const set = run(sb.store.root, ["state", "set", "1", "--seam", A, "--seam", B]);
    assert.equal(set.code, 0, set.stderr);
    assert.deepEqual(only(sb).seams, [A, B]);
    assert.match(set.stdout, /seams: 0 seam\(s\) replaced with 2/);
    assert.match(set.stdout, /added "CLI: `mstack state add` exit code and stdout"/);
    assert.match(set.stdout, /added "`withLock\(file, run, opts\)` in src\/tsv\.ts"/);
  } finally {
    sb.dispose();
  }
});

test("--clear seams removes the key, reports it, and is a no-op the second time", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ seams: [A, B], source: "issue #4" })]));
    const cleared = run(sb.store.root, ["state", "set", "1", "--clear", "seams"]);
    assert.equal(cleared.code, 0, cleared.stderr);
    assert.equal("seams" in rawOnly(sb), false, "--clear must remove the key, not leave []");
    assert.equal(only(sb).source, "issue #4", "clearing seams must not touch another field");
    assert.match(cleared.stdout, /seams: .* -> \(unset\)/);
    assert.match(cleared.stdout, /dropped "CLI: `mstack state add` exit code and stdout"/);
    assert.match(cleared.stdout, /dropped "`withLock\(file, run, opts\)` in src\/tsv\.ts"/);

    const again = run(sb.store.root, ["state", "set", "1", "--clear", "seams"]);
    assert.equal(again.code, 0, again.stderr);
    assert.match(again.stdout, /seams: already unset/);
  } finally {
    sb.dispose();
  }
});

test("--seam and --clear seams in one command contradict each other", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ seams: [A] })]));
    const both = run(sb.store.root, ["state", "set", "1", "--seam", B, "--clear", "seams"]);
    assert.equal(both.code, 2);
    assert.match(both.stderr, /--seam and --clear seams in one command contradict each other/);
    assert.deepEqual(only(sb).seams, [A]);
  } finally {
    sb.dispose();
  }
});

test("seams survive an update to another field and a status move", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ seams: [A, B] })]));
    assert.equal(run(sb.store.root, ["state", "set", "1", "--source", "direct request"]).code, 0);
    assert.equal(run(sb.store.root, ["state", "set", "1", "--add-acceptance", "one more"]).code, 0);
    assert.equal(run(sb.store.root, ["state", "set", "1", "--status", "in_progress"]).code, 0);
    assert.deepEqual(only(sb).seams, [A, B]);
  } finally {
    sb.dispose();
  }
});

test("a seams value that is not an array of strings is refused when the state is read", () => {
  const sb = sandbox();
  try {
    for (const bad of ["one string", { a: 1 }, [A, 3]]) {
      sb.writeState(state([item({ seams: bad })]));
      const listed = run(sb.store.root, ["state", "list"]);
      assert.equal(listed.code, 2, `seams ${JSON.stringify(bad)} must be refused`);
      assert.match(listed.stderr, /seams must be an array of strings/);
    }
  } finally {
    sb.dispose();
  }
});

test("a hand-edited blank seam is refused when read, and an empty list is still accepted", () => {
  const sb = sandbox();
  try {
    for (const blank of [[""], ["   "], [A, ""]]) {
      sb.writeState(state([item({ seams: blank })]));
      const listed = run(sb.store.root, ["state", "list"]);
      assert.equal(listed.code, 2, `seams ${JSON.stringify(blank)} must be refused`);
      assert.match(listed.stderr, /seams must not hold a blank string/);
    }
    sb.writeState(state([item({ seams: [] })]));
    const empty = run(sb.store.root, ["state", "list"]);
    assert.equal(empty.code, 0, "an empty list says 'no seam' and stays readable");
  } finally {
    sb.dispose();
  }
});
