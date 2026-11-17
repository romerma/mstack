import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { DECIDE, STATE_ADD, STATE_SET } from "../src/cliopts.ts";
import { item, sandbox, state } from "./helpers.ts";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");

/**
 * The CLI under each runtime it supports, spawned directly rather than through
 * `bin/mstack`, which always picks bun when it is installed and so would leave
 * the node half of "both runtimes" untested. A runtime that is not installed
 * here is left out, and the node one always is: it is what runs this file's
 * node half.
 */
const RUNTIMES: { name: string; exe: string; flags: string[] }[] = [
  { name: "node", exe: process.execPath.endsWith("bun") ? "node" : process.execPath, flags: ["--disable-warning=ExperimentalWarning", "--experimental-strip-types"] },
  { name: "bun", exe: "bun", flags: [] },
].filter((rt) => spawnSync(rt.exe, ["--version"], { timeout: 10_000 }).status === 0);

type Result = { stdout: string; stderr: string; code: number };

function run(rt: (typeof RUNTIMES)[number], cwd: string, args: readonly string[]): Result {
  const result = spawnSync(rt.exe, [...rt.flags, CLI, ...args], { cwd, encoding: "utf8", timeout: 30_000 });
  if (result.error !== undefined) throw result.error;
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status ?? 1 };
}

/** One test per runtime, so a failure names the runtime it failed on. */
function onEach(name: string, body: (call: (cwd: string, ...args: string[]) => Result) => void): void {
  for (const rt of RUNTIMES) test(`${name} [${rt.name}]`, () => body((cwd, ...args) => run(rt, cwd, args)));
}

function stateBytes(sb: ReturnType<typeof sandbox>): string {
  return readFileSync(sb.store.state, "utf8");
}

onEach("--help on state set prints the flags, exits 0, and neither resolves --help as an item nor writes", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const before = stateBytes(sb);
    for (const flag of ["--help", "-h"]) {
      const result = cli(sb.store.root, "state", "set", flag);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.match(result.stdout, /--add-acceptance/);
      assert.doesNotMatch(result.stdout, /no item matches/);
    }
    // with a ref in front, too
    const withRef = cli(sb.store.root, "state", "set", "1", "--help");
    assert.equal(withRef.code, 0, withRef.stderr);
    assert.match(withRef.stdout, /--clear/);
    assert.equal(stateBytes(sb), before);
  } finally {
    sb.dispose();
  }
});

onEach("--help on state add and decide prints their flags to stdout, exits 0 and writes nothing", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const before = stateBytes(sb);
    const decisionsBefore = readFileSync(sb.store.decisions, "utf8");

    const add = cli(sb.store.root, "state", "add", "--help");
    assert.equal(add.code, 0, add.stderr);
    assert.equal(add.stderr, "");
    for (const flag of ["--slug", "--title", "--acceptance", "--seam", "--decision-required"]) {
      assert.ok(add.stdout.includes(flag), `state add --help should name ${flag}:\n${add.stdout}`);
    }

    const decide = cli(sb.store.root, "decide", "--help");
    assert.equal(decide.code, 0, decide.stderr);
    assert.equal(decide.stderr, "");
    for (const flag of ["--phase", "--decision", "--why", "--evidence", "--result", "--resolves"]) {
      assert.ok(decide.stdout.includes(flag), `decide --help should name ${flag}:\n${decide.stdout}`);
    }

    assert.equal(stateBytes(sb), before);
    assert.equal(readFileSync(sb.store.decisions, "utf8"), decisionsBefore);
  } finally {
    sb.dispose();
  }
});

onEach("help works outside an mstack repository, because asking what a flag is needs no store", (cli) => {
  const sb = sandbox({ git: false });
  try {
    const result = cli("/tmp", "state", "set", "--help");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /--add-acceptance/);
  } finally {
    sb.dispose();
  }
});

test("every flag the parser takes is in that command's help, because both are built from one table", () => {
  const sb = sandbox();
  try {
    for (const [name, spec, args] of [
      ["state add", STATE_ADD, ["state", "add"]],
      ["state set", STATE_SET, ["state", "set"]],
      ["decide", DECIDE, ["decide"]],
    ] as const) {
      for (const rt of RUNTIMES) {
        const help = run(rt, sb.store.root, [...args, "--help"]).stdout;
        for (const flag of Object.keys(spec.flags)) {
          assert.ok(help.includes(`--${flag}`), `${name} --help [${rt.name}] is missing --${flag}:\n${help}`);
        }
      }
    }
  } finally {
    sb.dispose();
  }
});
