import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGate } from "../src/gate.ts";
import { defaultBranch } from "../src/git.ts";
import { storeAt, type Store } from "../src/paths.ts";
import { setup } from "../src/setup.ts";
import { measureDiff } from "../src/size.ts";
import { captured, item, sandbox, state, trackCurrent } from "./helpers.ts";

/**
 * Item 40: an item's size and the commit it started from.
 *
 * Two seams. The CLI (`state add`, `state set`, `state show`) is spawned under
 * each runtime, as `tests/state-cli.test.ts` does. The gate is run in-process
 * the way `tests/gate.test.ts` does, over a real git repository, with one spawned
 * run to pin the exit code. Expected numbers are the acceptance's own (60 lines,
 * 3 files), written out, never read from the constants under test.
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");
const SPAWN = { timeout: 120_000 };

const RUNTIMES: { name: string; exe: string; flags: string[] }[] = [
  { name: "node", exe: process.execPath.endsWith("bun") ? "node" : process.execPath, flags: ["--disable-warning=ExperimentalWarning", "--experimental-strip-types"] },
  { name: "bun", exe: "bun", flags: [] },
].filter((rt) => spawnSync(rt.exe, ["--version"], { timeout: 10_000 }).status === 0);

type Box = ReturnType<typeof sandbox>;
type Result = { stdout: string; stderr: string; code: number };

function spawnCli(rt: (typeof RUNTIMES)[number], cwd: string, args: readonly string[]): Result {
  const r = spawnSync(rt.exe, [...rt.flags, CLI, ...args], { cwd, encoding: "utf8", timeout: 30_000 });
  if (r.error !== undefined) throw r.error;
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? 1 };
}

function onEach(name: string, body: (cli: (box: Box, ...args: string[]) => Result) => void): void {
  for (const rt of RUNTIMES) {
    test(`${name} [${rt.name}]`, SPAWN, () => body((box, ...args) => spawnCli(rt, box.store.root, args)));
  }
}

const bytes = (box: Box): string => readFileSync(box.store.state, "utf8");
const json = (box: Box, id = 1): Record<string, unknown> =>
  (JSON.parse(bytes(box)) as { items: Record<string, unknown>[] }).items.find((i) => i["id"] === id)!;
const git = (box: Box, ...args: string[]): string =>
  execFileSync("git", args, { cwd: box.store.root, encoding: "utf8" }).trim();

function withBox(body: (box: Box) => void, options: { git?: boolean } = {}): void {
  const box = sandbox(options);
  try {
    body(box);
  } finally {
    box.dispose();
  }
}

// ---------------------------------------------------------------- size

onEach("state add --size accepts s, m and l, and state show prints it as text and as json", (cli) => {
  withBox((box) => {
    box.writeState(state([]));
    for (const size of ["s", "m", "l"]) {
      const added = cli(box, "state", "add", "--slug", `item-${size}`, "--title", "T", "--size", size);
      assert.equal(added.code, 0, added.stderr);
      const shown = cli(box, "state", "show", `item-${size}`);
      assert.match(shown.stdout, new RegExp(`^size: ${size}$`, "m"));
      const raw = JSON.parse(cli(box, "state", "show", `item-${size}`, "--json").stdout) as Record<string, unknown>;
      assert.equal(raw["size"], size);
    }
  });
});

onEach("state set --size changes it and states the change", (cli) => {
  withBox((box) => {
    box.writeState(state([item({ size: "s" })]));
    const set = cli(box, "state", "set", "1", "--size", "l");
    assert.equal(set.code, 0, set.stderr);
    assert.match(set.stdout, /size: "s" -> "l"/);
    assert.equal(json(box)["size"], "l");
  });
});

onEach("an invalid size is refused with the value and the three allowed ones, and nothing is written", (cli) => {
  withBox((box) => {
    box.writeState(state([item()]));
    const before = bytes(box);
    for (const bad of ["xl", "S", "medium", ""]) {
      const set = cli(box, "state", "set", "1", "--size", bad);
      assert.notEqual(set.code, 0, `state set --size '${bad}'`);
      assert.ok(set.stderr.includes(`'${bad}'`), set.stderr);
      assert.match(set.stderr, /s, m or l/);
      assert.equal(bytes(box), before);
    }
    const added = cli(box, "state", "add", "--slug", "other", "--title", "T", "--size", "xl");
    assert.notEqual(added.code, 0);
    assert.ok(added.stderr.includes("'xl'"), added.stderr);
    assert.match(added.stderr, /s, m or l/);
    assert.equal(bytes(box), before);
  });
});

onEach("state set --clear size removes it, and clearing an absent size is a no-op that says so", (cli) => {
  withBox((box) => {
    box.writeState(state([item({ size: "s" })]));
    const cleared = cli(box, "state", "set", "1", "--clear", "size");
    assert.equal(cleared.code, 0, cleared.stderr);
    assert.equal("size" in json(box), false);
    assert.doesNotMatch(cli(box, "state", "show", "1").stdout, /^size:/m);
    const again = cli(box, "state", "set", "1", "--clear", "size");
    assert.equal(again.code, 0, again.stderr);
    assert.match(again.stdout, /size: already unset/);
  });
});

onEach("--size and --clear size in one command contradict and nothing is written", (cli) => {
  withBox((box) => {
    box.writeState(state([item({ size: "s" })]));
    const before = bytes(box);
    const r = cli(box, "state", "set", "1", "--size", "l", "--clear", "size");
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /contradict/);
    assert.equal(bytes(box), before);
  });
});

onEach("an item written by an older mstack has no size, shows none, and no write adds one", (cli) => {
  withBox((box) => {
    box.writeState(state([item(), item({ id: 2, slug: "second", title: "Second" })]));
    assert.doesNotMatch(cli(box, "state", "show", "1").stdout, /^size:/m);
    const before = bytes(box);
    cli(box, "state", "list");
    cli(box, "state", "show", "1", "--json");
    assert.equal(bytes(box), before);
    const set = cli(box, "state", "set", "2", "--title", "Renamed");
    assert.equal(set.code, 0, set.stderr);
    assert.equal("size" in json(box, 1), false);
    assert.equal("size" in json(box, 2), false);
    assert.equal("base" in json(box, 1), false);
  });
});

onEach("a size in state.json outside s, m and l is a read error that names the field and the value", (cli) => {
  withBox((box) => {
    box.writeState(state([item({ size: "xl" })]));
    for (const args of [["state", "list"], ["state", "show", "1"], ["gate"]]) {
      const r = cli(box, ...args);
      assert.notEqual(r.code, 0, args.join(" "));
      assert.match(r.stdout + r.stderr, /\.items\[0\]\.size must be s, m or l, got "xl"/, args.join(" "));
    }
  });
});

// ---------------------------------------------------------------- base

onEach("the first move to in_progress records the commit HEAD resolves to", (cli) => {
  withBox((box) => {
    box.writeState(state([item()]));
    const head = git(box, "rev-parse", "HEAD");
    const moved = cli(box, "state", "set", "1", "--status", "in_progress");
    assert.equal(moved.code, 0, moved.stderr);
    assert.equal(json(box)["base"], head);
    assert.match(cli(box, "state", "show", "1").stdout, new RegExp(`^base: ${head}$`, "m"));
    assert.match(moved.stdout, /base:/);
  });
});

onEach("a later return to in_progress leaves the base alone", (cli) => {
  withBox((box) => {
    box.writeState(state([item()]));
    const first = git(box, "rev-parse", "HEAD");
    cli(box, "state", "set", "1", "--status", "in_progress");
    const second = box.commit();
    assert.notEqual(second, first);
    assert.equal(cli(box, "state", "set", "1", "--status", "reviewing").code, 0);
    const back = cli(box, "state", "set", "1", "--status", "in_progress");
    assert.equal(back.code, 0, back.stderr);
    assert.equal(json(box)["base"], first);
  });
});

onEach("a status move to anything else records no base", (cli) => {
  withBox((box) => {
    box.writeState(state([item()]));
    assert.equal(cli(box, "state", "set", "1", "--status", "specifying").code, 0);
    assert.equal("base" in json(box), false);
  });
});

onEach("state set --base replaces the base with a commit that resolves, and refuses one that does not", (cli) => {
  withBox((box) => {
    box.writeState(state([item()]));
    const first = git(box, "rev-parse", "HEAD");
    cli(box, "state", "set", "1", "--status", "in_progress");
    const second = box.commit();
    const short = second.slice(0, 10);
    const ok = cli(box, "state", "set", "1", "--base", short);
    assert.equal(ok.code, 0, ok.stderr);
    assert.equal(json(box)["base"], second, "stored in full");
    assert.match(ok.stdout, new RegExp(`base: "${first}" -> "${second}"`));

    const before = bytes(box);
    for (const bad of ["not-a-commit", "0".repeat(40), "--output=x", "HEAD:nothing"]) {
      const r = cli(box, "state", "set", "1", "--base", bad);
      assert.notEqual(r.code, 0, `--base ${bad}`);
      assert.ok(r.stderr.includes(bad), r.stderr);
      assert.equal(bytes(box), before);
    }
  });
});

onEach("--clear base is refused, says why and names --base, and writes nothing", (cli) => {
  withBox((box) => {
    box.writeState(state([item()]));
    cli(box, "state", "set", "1", "--status", "in_progress");
    const before = bytes(box);
    const r = cli(box, "state", "set", "1", "--clear", "base");
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /gate measures/);
    assert.match(r.stderr, /--base/);
    assert.equal(bytes(box), before);
  });
});

onEach("outside a git repository the move succeeds, records no base and says so", (cli) => {
  withBox((box) => {
    box.writeState(state([item()]));
    const moved = cli(box, "state", "set", "1", "--status", "in_progress");
    assert.equal(moved.code, 0, moved.stderr);
    assert.equal(json(box)["status"], "in_progress");
    assert.equal("base" in json(box), false);
    assert.match(moved.stdout, /base: not recorded/);
  }, { git: false });
});

onEach("a repository with no commit yet records no base either", (cli) => {
  withBox((box) => {
    execFileSync("git", ["init", "-q"], { cwd: box.store.root });
    box.writeState(state([item()]));
    const moved = cli(box, "state", "set", "1", "--status", "in_progress");
    assert.equal(moved.code, 0, moved.stderr);
    assert.equal("base" in json(box), false);
    assert.match(moved.stdout, /base: not recorded/);
  }, { git: false });
});

// ---------------------------------------------------------------- sdd and s

onEach("sdd with size s is refused at state add, naming both fields, and writes nothing", (cli) => {
  withBox((box) => {
    box.writeState(state([]));
    const before = bytes(box);
    const r = cli(box, "state", "add", "--slug", "x", "--title", "T", "--sdd", "--size", "s");
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /sdd/);
    assert.match(r.stderr, /size s/);
    assert.match(r.stderr, /--size m|--sdd/);
    assert.equal(bytes(box), before);
  });
});

onEach("state set --size s on an sdd item is refused and writes nothing", (cli) => {
  withBox((box) => {
    box.writeState(state([item({ sdd: true })]));
    const before = bytes(box);
    const r = cli(box, "state", "set", "1", "--size", "s");
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /sdd/);
    assert.match(r.stderr, /size s/);
    assert.equal(bytes(box), before);
  });
});

onEach("state set --sdd on a size s item is refused and writes nothing", (cli) => {
  withBox((box) => {
    box.writeState(state([item({ size: "s" })]));
    const before = bytes(box);
    const r = cli(box, "state", "set", "1", "--sdd");
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /sdd/);
    assert.match(r.stderr, /size s/);
    assert.equal(bytes(box), before);
  });
});

onEach("sdd with size m or l, and a command that drops one of the pair, are fine", (cli) => {
  withBox((box) => {
    box.writeState(state([item({ sdd: true, size: "m" }), item({ id: 2, slug: "two", size: "s" })]));
    assert.equal(cli(box, "state", "set", "1", "--size", "l").code, 0);
    assert.equal(cli(box, "state", "set", "1", "--clear", "sdd", "--size", "s").code, 0);
    assert.equal(cli(box, "state", "set", "2", "--sdd", "--size", "m").code, 0);
  });
});

onEach("help for state add and state set lists --size, and state set lists --base and says --clear takes size", (cli) => {
  withBox((box) => {
    const add = cli(box, "state", "add", "--help").stdout;
    assert.match(add, /--size <s\|m\|l>/);
    const set = cli(box, "state", "set", "--help").stdout;
    assert.match(set, /--size <s\|m\|l>/);
    assert.match(set, /--base <commit>/);
    assert.match(set, /--clear <field>.*size/);
  });
});

// ---------------------------------------------------------------- gate

/** `n` distinct lines, so two files of the same length differ from each other. */
const lines = (tag: string, n: number): string => Array.from({ length: n }, (_, i) => `${tag} ${i}\n`).join("");

function put(box: Box, path: string, content: string | Buffer): void {
  const full = join(box.store.root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** An active size-s item with a base, in a repository whose base commit is `sha`. */
function smallItem(box: Box, over: Record<string, unknown> = {}, base: string = git(box, "rev-parse", "HEAD")): void {
  box.writeState(state([item({ status: "in_progress", size: "s", base, ...over })]));
  trackCurrent(box);
}

function gateFailures(box: Box): readonly string[] {
  return captured(() => runGate(box.store, { quiet: true })).value.failures;
}

const commitAll = (box: Box, message: string): string => {
  git(box, "add", "-A");
  git(box, "commit", "-q", "-m", message);
  return git(box, "rev-parse", "HEAD");
};

const GATE = { timeout: 60_000 };

test("exactly 60 changed lines in exactly 3 code files passes", GATE, () => {
  withBox((box) => {
    smallItem(box);
    for (const n of ["a", "b", "c"]) put(box, `src/${n}.ts`, lines(n, 20));
    assert.deepEqual(gateFailures(box), []);
  });
});

test("61 changed lines fails with both counts, both limits and the fix", GATE, () => {
  withBox((box) => {
    smallItem(box);
    put(box, "src/a.ts", lines("a", 20));
    put(box, "src/b.ts", lines("b", 20));
    put(box, "src/c.ts", lines("c", 21));
    const failures = gateFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    const [line] = failures;
    assert.match(line!, /61 lines/);
    assert.match(line!, /3 files/);
    assert.match(line!, /60 lines/);
    assert.match(line!, /limit/);
    assert.match(line!, /mstack state set storage-layer --size m/);
  });
});

test("4 code files fails even when they hold 4 lines", GATE, () => {
  withBox((box) => {
    smallItem(box);
    for (const n of ["a", "b", "c", "d"]) put(box, `src/${n}.ts`, `${n}\n`);
    const failures = gateFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0]!, /4 lines/);
    assert.match(failures[0]!, /4 files/);
    assert.match(failures[0]!, /3 files/);
  });
});

test("test files, doc files and everything under .mstack/ do not count", GATE, () => {
  withBox((box) => {
    smallItem(box);
    for (const n of ["a", "b", "c"]) put(box, `src/${n}.ts`, lines(n, 20));
    put(box, "tests/a.test.ts", lines("t", 500));
    put(box, "src/b.spec.ts", lines("s", 500));
    put(box, "docs/guide.txt", lines("d", 500));
    put(box, "README.md", lines("r", 500));
    put(box, "CHANGELOG.md", lines("c", 500));
    put(box, ".mstack/progress/impl_x.md", lines("p", 500));
    put(box, ".mstack/extra.json", lines("j", 500));
    assert.deepEqual(gateFailures(box), []);
  });
});

test("a change under src/test/ (Maven and Gradle) does not count as code", GATE, () => {
  withBox((box) => {
    smallItem(box);
    for (const n of ["a", "b", "c"]) put(box, `src/${n}.ts`, lines(n, 20));
    put(box, "src/test/java/com/x/GreetTest.java", lines("j", 500));
    put(box, "svc/api/src/test/kotlin/GreetTest.kt", lines("k", 500));
    assert.deepEqual(gateFailures(box), []);
  });
});

test("a code file under .mstack/ is dropped by the store exclusion and not by the classifier", GATE, () => {
  withBox((box) => {
    smallItem(box);
    for (const n of ["a", "b", "c"]) put(box, `src/${n}.ts`, lines(n, 20));
    put(box, ".mstack/helper.ts", lines("h", 100));
    assert.deepEqual(gateFailures(box), []);
  });
});

test("an uncommitted edit to a tracked file counts insertions plus deletions", GATE, () => {
  withBox((box) => {
    put(box, "src/a.ts", lines("old", 30));
    const base = commitAll(box, "add a");
    smallItem(box, {}, base);
    put(box, "src/a.ts", lines("new", 30));
    assert.deepEqual(gateFailures(box), [], "30 deleted + 30 inserted is exactly 60");
    put(box, "src/a.ts", lines("new", 31));
    const failures = gateFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0]!, /61 lines in 1 file/);
  });
});

test("commits since the base count together with uncommitted and untracked changes", GATE, () => {
  withBox((box) => {
    const base = box.sha;
    smallItem(box, {}, base);
    put(box, "src/a.ts", lines("a", 30));
    commitAll(box, "committed");
    put(box, "src/b.ts", lines("b", 20));
    git(box, "add", "src/b.ts");
    put(box, "src/c.ts", lines("c", 11));
    const failures = gateFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0]!, /61 lines in 3 files/);
  });
});

test("an untracked file that git ignores does not count", GATE, () => {
  withBox((box) => {
    put(box, ".gitignore", "gen/\n");
    const base = commitAll(box, "ignore gen");
    smallItem(box, {}, base);
    put(box, "gen/out.ts", lines("g", 500));
    for (const n of ["a", "b", "c"]) put(box, `src/${n}.ts`, lines(n, 20));
    assert.deepEqual(gateFailures(box), []);
  });
});

test("a binary file counts as a file and as zero lines", GATE, () => {
  withBox((box) => {
    smallItem(box);
    const blob = Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.alloc(5000, 10)]);
    for (const n of ["a", "b", "c"]) put(box, `assets/${n}.bin`, blob);
    assert.deepEqual(gateFailures(box), [], "three binaries, zero lines");
    put(box, "assets/d.bin", blob);
    const failures = gateFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0]!, /0 lines in 4 files/);
  });
});

test("a tracked binary file that changed counts as a file and as zero lines", GATE, () => {
  withBox((box) => {
    const blob = (byte: number): Buffer => Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.alloc(5000, byte)]);
    for (const n of ["a", "b", "c", "d"]) put(box, `assets/${n}.bin`, blob(10));
    const base = commitAll(box, "binaries");
    smallItem(box, {}, base);
    for (const n of ["a", "b", "c"]) put(box, `assets/${n}.bin`, blob(11));
    assert.deepEqual(gateFailures(box), [], "three changed binaries, zero lines");
    put(box, "assets/d.bin", blob(11));
    const failures = gateFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0]!, /0 lines in 4 files/);
  });
});

test("size m, size l, an absent size, an item with no base and an inactive item are not measured", GATE, () => {
  for (const over of [{ size: "m" }, { size: "l" }, { size: undefined }, { base: undefined }, { status: "pending" }, { status: "done", closed_by: "x" }]) {
    withBox((box) => {
      smallItem(box, over);
      for (const n of ["a", "b", "c", "d"]) put(box, `src/${n}.ts`, lines(n, 40));
      const failures = gateFailures(box).filter((f) => /lines in|--base/.test(f));
      assert.deepEqual(failures, [], JSON.stringify(over));
    });
  }
});

test("a base git cannot resolve fails with a fix that names --base", GATE, () => {
  withBox((box) => {
    smallItem(box, {}, "f".repeat(40));
    const failures = gateFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.ok(failures[0]!.includes("f".repeat(40)), failures[0]);
    assert.match(failures[0]!, /--base/);
  });
});

// ------------------------------------------------- where the measurement starts

/**
 * Put the sandbox on a branch called `name` (renamed, so no `main` or `master`
 * is left behind unless `name` is one), with the store outside git's view, so
 * checkouts, rebases and merges leave `.mstack/` alone and `add -A` never
 * commits it.
 */
function onBranch(box: Box, name: string): void {
  appendFileSync(join(box.store.root, ".git", "info", "exclude"), "\n.mstack/\n");
  git(box, "branch", "-m", name);
}

/** The one line the gate prints for the size check, `[ok]` or `[fail]`. */
function sizeLine(box: Box, store: Store = box.store): string {
  const { out } = captured(() => runGate(store));
  const found = out.split("\n").filter((l) => l.includes(" is size s"));
  assert.equal(found.length, 1, out);
  return found[0]!;
}

/** The gate's failures from the size check alone, each with its fix after `->`. */
function sizeFailures(box: Box, store: Store = box.store): readonly string[] {
  return captured(() => runGate(store, { quiet: true })).value.failures.filter((f) => f.includes(" is size s"));
}

const short = (sha: string): string => sha.slice(0, 8);

/**
 * The round 1 review's repro: a 10-line fix on a branch, then five 40-line
 * files land on main, then the branch takes them in. Returns the base and the
 * tip of main after the other work.
 */
function branchThenMainMoves(box: Box): { base: string; mainTip: string } {
  onBranch(box, "main");
  const base = git(box, "rev-parse", "HEAD");
  git(box, "checkout", "-q", "-b", "feat/one");
  smallItem(box, {}, base);
  put(box, "fix.ts", lines("f", 10));
  commitAll(box, "fix");
  git(box, "checkout", "-q", "main");
  for (const n of ["p", "q", "r", "s", "t"]) put(box, `${n}.ts`, lines(n, 40));
  const mainTip = commitAll(box, "other work on main");
  git(box, "checkout", "-q", "feat/one");
  return { base, mainTip };
}

test("after a rebase onto a main that moved, only the branch's own lines count, from where it left main", GATE, () => {
  withBox((box) => {
    const { base, mainTip } = branchThenMainMoves(box);
    git(box, "rebase", "-q", "main");
    assert.deepEqual(sizeFailures(box), []);
    const line = sizeLine(box);
    assert.match(line, /10 lines in 1 file of code/);
    assert.ok(line.includes(`since ${short(mainTip)} (where this branch left main; base ${short(base)} is older)`), line);
  });
});

test("after main is merged into the branch, only the branch's own lines count, from where it left main", GATE, () => {
  withBox((box) => {
    const { base, mainTip } = branchThenMainMoves(box);
    git(box, "merge", "-q", "--no-ff", "--no-edit", "main");
    assert.deepEqual(sizeFailures(box), []);
    const line = sizeLine(box);
    assert.match(line, /10 lines in 1 file of code/);
    assert.ok(line.includes(`since ${short(mainTip)} (where this branch left main; base ${short(base)} is older)`), line);
  });
});

test("a main that moved but was not brought in changes nothing: the branch is measured from its base", GATE, () => {
  withBox((box) => {
    const { base } = branchThenMainMoves(box);
    const line = sizeLine(box);
    assert.ok(line.includes(`10 lines in 1 file of code since ${short(base)}, within`), line);
  });
});

test("after a fetch and a rebase onto origin/main, a local main left behind does not hold the start back", GATE, () => {
  withBox((box) => {
    const { base, mainTip } = branchThenMainMoves(box);
    git(box, "update-ref", "refs/remotes/origin/main", mainTip);
    git(box, "branch", "-f", "main", base);
    git(box, "rebase", "-q", "origin/main");
    const line = sizeLine(box);
    assert.ok(line.includes(`10 lines in 1 file of code since ${short(mainTip)} (where this branch left main; base ${short(base)} is older)`), line);
  });
});

test("a branch stacked on another is measured from its base, so the parent branch's work does not count", GATE, () => {
  withBox((box) => {
    onBranch(box, "main");
    git(box, "checkout", "-q", "-b", "parent");
    for (const n of ["p", "q", "r", "s"]) put(box, `${n}.ts`, lines(n, 40));
    const base = commitAll(box, "the parent branch's work");
    git(box, "checkout", "-q", "-b", "child");
    smallItem(box, {}, base);
    put(box, "fix.ts", lines("f", 10));
    commitAll(box, "fix");
    const line = sizeLine(box);
    assert.ok(line.includes(`10 lines in 1 file of code since ${short(base)}, within`), line);
  });
});

test("work committed straight onto main is measured from the base", GATE, () => {
  withBox((box) => {
    onBranch(box, "main");
    const base = git(box, "rev-parse", "HEAD");
    smallItem(box, {}, base);
    put(box, "fix.ts", lines("f", 61));
    commitAll(box, "fix on main");
    const failures = sizeFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.ok(failures[0]!.includes(`code diff from ${short(base)} is 61 lines in 1 file`), failures[0]);
  });
});

test("a base a rebase rewrote is replaced by where the branch left main, and the line says so", GATE, () => {
  withBox((box) => {
    onBranch(box, "main");
    git(box, "checkout", "-q", "-b", "feat/one");
    put(box, "first.ts", lines("a", 5));
    const base = commitAll(box, "the branch's first commit, where the item starts");
    smallItem(box, {}, base);
    put(box, "fix.ts", lines("f", 10));
    commitAll(box, "fix");
    git(box, "checkout", "-q", "main");
    for (const n of ["p", "q", "r", "s", "t"]) put(box, `${n}.ts`, lines(n, 40));
    const mainTip = commitAll(box, "other work on main");
    git(box, "checkout", "-q", "feat/one");
    git(box, "rebase", "-q", "main");
    const line = sizeLine(box);
    assert.ok(
      line.includes(`15 lines in 2 files of code since ${short(mainTip)} (where this branch left main; base ${short(base)} is not in this branch's history)`),
      line,
    );
  });
});

test("a base a rebase rewrote, with no fork point to use, fails with a fix that names --base", GATE, () => {
  // On main itself HEAD has no commits past main; on a repository with no
  // default branch there is no main at all. Either way nothing replaces the base.
  for (const branch of ["main", "stem"]) {
    withBox((box) => {
      onBranch(box, branch);
      put(box, "first.ts", lines("a", 5));
      const base = commitAll(box, "where the item starts");
      smallItem(box, {}, base);
      put(box, "fix.ts", lines("f", 10));
      commitAll(box, "fix");
      // A new parent under the item's commits, so the rebase has to rewrite
      // them: `--force-rebase` alone gives back the same ids within a second.
      git(box, "checkout", "-q", "-b", "side", box.sha);
      put(box, "side.txt", "side\n");
      commitAll(box, "side");
      git(box, "checkout", "-q", branch);
      git(box, "rebase", "-q", "side");
      const failures = sizeFailures(box);
      assert.equal(failures.length, 1, `${branch}: ${JSON.stringify(failures)}`);
      assert.ok(failures[0]!.includes(`its base ${short(base)} is not in this branch's history`), failures[0]);
      assert.match(failures[0]!, /-> .*mstack state set storage-layer --base <commit>/);
    });
  }
});

test("with no main, no master and no origin/HEAD the default branch reads as main, which does not resolve, so the base is used", GATE, () => {
  withBox((box) => {
    onBranch(box, "stem");
    assert.equal(defaultBranch(box.store), "main");
    const base = git(box, "rev-parse", "HEAD");
    git(box, "checkout", "-q", "-b", "feat/one");
    smallItem(box, {}, base);
    put(box, "fix.ts", lines("f", 10));
    commitAll(box, "fix");
    git(box, "checkout", "-q", "stem");
    for (const n of ["p", "q", "r", "s", "t"]) put(box, `${n}.ts`, lines(n, 40));
    commitAll(box, "other work on stem");
    git(box, "checkout", "-q", "feat/one");
    git(box, "merge", "-q", "--no-ff", "--no-edit", "stem");
    const failures = sizeFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.ok(failures[0]!.includes(`code diff from ${short(base)} is 210 lines in 6 files`), failures[0]);
  });
});

// ------------------------------------------------- a store in a sub-directory

/**
 * A store in `sub` of the sandbox's repository, the layout `mstack setup` run
 * in `pkg/app` of a monorepo gives, with an active size-s item based at `base`.
 */
function subStore(box: Box, sub: string, base: string): Store {
  const root = join(box.store.root, sub);
  mkdirSync(root, { recursive: true });
  captured(() => setup(root));
  const store = storeAt(root);
  writeFileSync(store.state, `${JSON.stringify(state([item({ status: "in_progress", size: "s", base })]), null, 2)}\n`);
  writeFileSync(store.current, "# Current session\n\n- **Item:** the one under test\n\n## Next step\n\ncarry on\n");
  return store;
}

test("a store in a sub-directory measures that directory only, tracked and untracked alike", GATE, () => {
  withBox((box) => {
    put(box, "pkg/app/src/a.ts", lines("a", 20));
    put(box, "top.ts", lines("t", 20));
    const base = commitAll(box, "one file inside the store's directory, one outside");
    const store = subStore(box, "pkg/app", base);
    put(box, "pkg/app/src/a.ts", lines("a", 30));
    put(box, "pkg/app/src/u.ts", lines("u", 15));
    put(box, "top.ts", lines("t", 300));
    put(box, "other.ts", lines("o", 500));
    const line = sizeLine(box, store);
    assert.match(line, /25 lines in 2 files of code/);
  });
});

test("in a sub-directory store, paths are classified from the store's root, so its tests/ holds tests", GATE, () => {
  withBox((box) => {
    put(box, "pkg/app/tests/y.ts", lines("y", 10));
    const base = commitAll(box, "a test under the store's directory");
    const store = subStore(box, "pkg/app", base);
    put(box, "pkg/app/tests/y.ts", lines("y", 300));
    put(box, "pkg/app/tests/x.ts", lines("x", 500));
    put(box, "pkg/app/src/b.ts", lines("b", 10));
    const line = sizeLine(box, store);
    assert.match(line, /10 lines in 1 file of code/);
  });
});

// ------------------------------------------------- what git's numstat says

test("a pure git mv of a code file counts as every line deleted plus every line added, in two files", GATE, () => {
  withBox((box) => {
    put(box, "src/old.ts", lines("o", 31));
    const base = commitAll(box, "add old");
    smallItem(box, {}, base);
    git(box, "mv", "src/old.ts", "src/new.ts");
    const failures = sizeFailures(box);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0]!, /62 lines in 2 files/);
  });
});

/**
 * Run `body` with a `git` first on PATH that forwards every call to the real
 * one, except `diff --numstat`, for which it prints `record`.
 *
 * git is the one thing here the project does not own, and no flag this code
 * passes makes the real one print a malformed record, so the stand-in is the
 * honest way to reach the parser through `measureDiff` itself.
 */
function withNumstat(record: string, body: () => void): void {
  const real = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
  const bin = mkdtempSync(join(tmpdir(), "mstack-fake-git-"));
  writeFileSync(
    join(bin, "git"),
    `#!/bin/sh\nfor arg in "$@"; do\n  if [ "$arg" = "--numstat" ]; then printf '${record}'; exit 0; fi\ndone\nexec '${real}' "$@"\n`,
    { mode: 0o755 },
  );
  const saved = process.env["PATH"];
  process.env["PATH"] = `${bin}${delimiter}${saved ?? ""}`;
  try {
    body();
  } finally {
    if (saved === undefined) delete process.env["PATH"];
    else process.env["PATH"] = saved;
    rmSync(bin, { recursive: true, force: true });
  }
}

test("a numstat record whose counts do not parse makes the diff unmeasurable, and the gate fails", GATE, () => {
  withBox((box) => {
    smallItem(box);
    put(box, "src/a.ts", lines("a", 5));
    // The record `git diff --numstat -z -M` prints for a rename.
    withNumstat("0\\t0\\t\\000src/old.ts\\000src/new.ts\\000", () => {
      assert.equal(measureDiff(box.store, box.sha), null);
      const failures = sizeFailures(box);
      assert.equal(failures.length, 1, JSON.stringify(failures));
      assert.match(failures[0]!, /git could not measure its diff/);
    });
    assert.deepEqual(measureDiff(box.store, box.sha), { lines: 5, files: 1 }, "the real git, for contrast");
  });
});

test("mstack gate exits 1 over the limit and prints the [fail] line, then 0 once the item is size m", GATE, () => {
  withBox((box) => {
    smallItem(box);
    for (const n of ["a", "b", "c", "d"]) put(box, `src/${n}.ts`, lines(n, 5));
    const rt = RUNTIMES[0]!;
    const red = spawnCli(rt, box.store.root, ["gate"]);
    assert.equal(red.code, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /\[fail\].*20 lines in 4 files/);
    assert.match(red.stdout, /fix: .*mstack state set storage-layer --size m/);
    assert.equal(spawnCli(rt, box.store.root, ["state", "set", "1", "--size", "m"]).code, 0);
    const green = spawnCli(rt, box.store.root, ["gate"]);
    assert.equal(green.code, 0, green.stdout + green.stderr);
  });
});
