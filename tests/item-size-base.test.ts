import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGate } from "../src/gate.ts";
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
