import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { DECIDE, STATE_ADD, STATE_SET, STATE_SHOW } from "../src/cliopts.ts";
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
      ["state show", STATE_SHOW, ["state", "show"]],
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

const FULL = {
  id: 7,
  slug: "everything",
  title: "An item that carries every field",
  description: "the longer prose",
  acceptance: ["first criterion", "second criterion"],
  status: "blocked",
  sdd: true,
  decision_required: "Should the export be public?",
  decision_resolved: "2026-11-01T10:00:00.000Z",
  source: "issue #7",
  verification: "npm test",
  seams: ["CLI: state show stdout", "CLI: exit codes"],
  closed_by: "a note",
  review_round: 2,
  tags: ["a", "b"],
};

onEach("state show prints one item with every field it carries, one per line, in a fixed order", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ id: 1, slug: "other-item" }), FULL]));
    for (const ref of ["everything", "7"]) {
      const result = cli(sb.store.root, "state", "show", ref);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(
        result.stdout,
        [
          "id: 7",
          "slug: everything",
          "title: An item that carries every field",
          "status: blocked",
          "source: issue #7",
          "description: the longer prose",
          "sdd: true",
          "decision_required: Should the export be public?",
          "decision_resolved: 2026-11-01T10:00:00.000Z",
          "verification: npm test",
          "closed_by: a note",
          "acceptance:",
          "  - first criterion",
          "  - second criterion",
          "seams:",
          "  - CLI: state show stdout",
          "  - CLI: exit codes",
          "review_round: 2",
          'tags: ["a","b"]',
          "",
        ].join("\n"),
      );
    }
  } finally {
    sb.dispose();
  }
});

onEach("state show prints nothing for a field the item does not carry", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const result = cli(sb.store.root, "state", "show", "storage-layer");
    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      result.stdout,
      [
        "id: 1",
        "slug: storage-layer",
        "title: Atomic JSON storage",
        "status: pending",
        "acceptance:",
        "  - load() returns [] when the file is absent",
        "",
      ].join("\n"),
    );
  } finally {
    sb.dispose();
  }
});

onEach("state show --json prints the raw object, unknown keys included", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([FULL]));
    const result = cli(sb.store.root, "state", "show", "7", "--json");
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), FULL);
  } finally {
    sb.dispose();
  }
});

onEach("state show without a ref, or with one that matches nothing, is a usage error", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const missing = cli(sb.store.root, "state", "show");
    assert.equal(missing.code, 2);
    assert.equal(missing.stdout, "");
    assert.match(missing.stderr, /state show needs an item id or slug/);

    const unknown = cli(sb.store.root, "state", "show", "nope");
    assert.equal(unknown.code, 2);
    assert.equal(unknown.stdout, "");
    assert.match(unknown.stderr, /no item matches 'nope'/);

    // a digit-prefixed slug is not an id, the same rule `state set` applies
    const prefixed = cli(sb.store.root, "state", "show", "1x");
    assert.equal(prefixed.code, 2);
    assert.match(prefixed.stderr, /no item matches '1x'/);
  } finally {
    sb.dispose();
  }
});

onEach("the global help names state show and says subcommands take --help", (cli) => {
  const result = cli("/tmp", "help");
  assert.equal(result.code, 0);
  assert.match(result.stdout, /state show <ref>/);
  assert.match(result.stdout, /--help/);
});
