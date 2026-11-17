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
    assert.ok(add.stdout.includes("--flag=value"), "the help says how to pass a value that starts with a dash");
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

onEach("a value that starts with -- is stored whole when passed as --flag=value", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([]));
    const added = cli(
      sb.store.root,
      "state", "add", "--slug=dashed", "--title=--a title",
      "--acceptance=--first criterion", "--acceptance=--second criterion",
      "--seam=--a seam", "--description=--prose", "--source=--origin", "--verification=--cmd",
      "--decision-required=--a fork",
    );
    assert.equal(added.code, 0, added.stderr);
    const [created] = JSON.parse(stateBytes(sb)).items;
    assert.equal(created.title, "--a title");
    assert.deepEqual(created.acceptance, ["--first criterion", "--second criterion"]);
    assert.deepEqual(created.seams, ["--a seam"]);
    assert.equal(created.description, "--prose");
    assert.equal(created.source, "--origin");
    assert.equal(created.verification, "--cmd");
    assert.equal(created.decision_required, "--a fork");

    const set = cli(sb.store.root, "state", "set", "dashed", "--add-acceptance=--third", "--acceptance=--only", "--status=pending");
    assert.equal(set.code, 2, "--acceptance and --add-acceptance in one command stay refused");
    const added2 = cli(sb.store.root, "state", "set", "dashed", "--add-acceptance=--third");
    assert.equal(added2.code, 0, added2.stderr);
    assert.deepEqual(JSON.parse(stateBytes(sb)).items[0].acceptance, ["--first criterion", "--second criterion", "--third"]);

    const decided = cli(sb.store.root, "decide", "--phase=implement", "--decision=--z is kept", "--result=--y");
    assert.equal(decided.code, 0, decided.stderr);
    const rows = readFileSync(sb.store.decisions, "utf8");
    assert.ok(rows.includes("--z is kept") && rows.includes("--y"), rows);
  } finally {
    sb.dispose();
  }
});

onEach("a value that starts with -- and follows its flag after a space is refused in mstack's words, naming --flag=value", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const before = stateBytes(sb);
    const decisionsBefore = readFileSync(sb.store.decisions, "utf8");
    for (const [args, flag, value] of [
      [["state", "add", "--slug", "x", "--title", "t", "--acceptance", "--needs the equals"], "--acceptance", "--needs the equals"],
      [["state", "add", "--slug", "x", "--title", "t", "--seam", "--surface"], "--seam", "--surface"],
      [["state", "set", "1", "--add-acceptance", "--appended"], "--add-acceptance", "--appended"],
      [["state", "set", "1", "--description", "-x"], "--description", "-x"],
      [["decide", "--decision", "--z"], "--decision", "--z"],
    ] as const) {
      const result = cli(sb.store.root, ...args);
      assert.equal(result.code, 2, `${args.join(" ")}: ${result.stdout}`);
      assert.equal(result.stdout, "");
      // mstack's own sentence, not the runtime's: node says "ambiguous", and the
      // text is not the same across versions.
      assert.match(result.stderr, new RegExp(`${flag} was followed by '${value}'`));
      assert.ok(result.stderr.includes(`${flag}=${value}`), `no ${flag}=${value} in: ${result.stderr}`);
      assert.doesNotMatch(result.stderr, /ambiguous|Did you forget/);
    }
    // a long value is abbreviated in the sentence but never in the fix, which has to be copyable
    const long = `--${"y".repeat(60)}`;
    const abbreviated = cli(sb.store.root, "decide", "--decision", long);
    assert.equal(abbreviated.code, 2);
    assert.ok(abbreviated.stderr.includes(`--decision=${long}`), abbreviated.stderr);
    assert.equal(stateBytes(sb), before);
    assert.equal(readFileSync(sb.store.decisions, "utf8"), decisionsBefore);
  } finally {
    sb.dispose();
  }
});

onEach("a flag followed by an ordinary value, a boolean flag, or a lone dash is not refused", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([]));
    const result = cli(sb.store.root, "state", "add", "--slug", "plain", "--sdd", "--title", "-", "--acceptance", "fine");
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(stateBytes(sb)).items[0].title, "-");
  } finally {
    sb.dispose();
  }
});

onEach("state set --acceptance on an item that has criteria names --add-acceptance; otherwise it stays quiet", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ acceptance: ["one", "two"] }), item({ id: 2, slug: "empty-list", acceptance: [] })]));

    const replaced = cli(sb.store.root, "state", "set", "1", "--acceptance", "only");
    assert.equal(replaced.code, 0, replaced.stderr);
    assert.match(replaced.stdout, /acceptance: 2 criterion\(s\) replaced with 1/);
    assert.match(replaced.stdout, /--add-acceptance/);
    assert.deepEqual(JSON.parse(stateBytes(sb)).items[0].acceptance, ["only"], "still a replace, with no prompt and no refusal");

    // nothing to replace, so nothing to warn about
    const fresh = cli(sb.store.root, "state", "set", "2", "--acceptance", "first");
    assert.equal(fresh.code, 0, fresh.stderr);
    assert.doesNotMatch(fresh.stdout, /--add-acceptance/);

    // the append itself, and a state add, are not replaces
    const appended = cli(sb.store.root, "state", "set", "1", "--add-acceptance", "more");
    assert.doesNotMatch(appended.stdout, /use --add-acceptance/);
    assert.doesNotMatch(appended.stdout, /replaced/);
    const added = cli(sb.store.root, "state", "add", "--slug", "new-one", "--title", "t", "--acceptance", "a");
    assert.equal(added.stdout.trim(), "added 3 new-one (pending)");
    assert.doesNotMatch(added.stdout, /--add-acceptance/);
  } finally {
    sb.dispose();
  }
});

onEach("state show refuses an item whose id another item shares, by id, by either slug, text and --json", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([
        item({ id: 5, slug: "first", title: "first", acceptance: ["x"], secret: "belongs to first" }),
        item({ id: 5, slug: "second", title: "second", acceptance: ["y"], mine: "second's" }),
        item({ id: 6, slug: "third", title: "third", acceptance: ["z"] }),
      ]),
    );
    const before = stateBytes(sb);
    for (const ref of ["5", "first", "second"]) {
      for (const extra of [[], ["--json"]]) {
        const result = cli(sb.store.root, "state", "show", ref, ...extra);
        assert.equal(result.code, 2, `${ref} ${extra.join(" ")}: ${result.stdout}`);
        assert.equal(result.stdout, "", "nothing that looks like an item is printed");
        assert.match(result.stderr, /an item with id 5 already exists/);
        assert.doesNotMatch(result.stderr, /belongs to first/);
      }
    }
    assert.equal(stateBytes(sb), before);

    // an item whose id is unique is still answered for, on the same store
    const third = cli(sb.store.root, "state", "show", "third", "--json");
    assert.equal(third.code, 0, third.stderr);
    assert.equal(JSON.parse(third.stdout).slug, "third");
    // and the read path that never mis-answered is unchanged
    assert.equal(cli(sb.store.root, "state", "list").code, 0);
  } finally {
    sb.dispose();
  }
});

onEach("state show --json prints exactly the item asked for when several items exist", (cli) => {
  const sb = sandbox();
  try {
    const items = [
      item({ id: 1, slug: "alpha", title: "alpha", acceptance: ["a"], note_a: "from alpha" }),
      item({ id: 2, slug: "beta", title: "beta", acceptance: ["b"], note_b: "from beta" }),
      item({ id: 3, slug: "gamma", title: "gamma", acceptance: ["c"], note_c: "from gamma" }),
    ];
    sb.writeState(state(items));
    for (const it of items) {
      for (const ref of [String(it["slug"]), String(it["id"])]) {
        const result = cli(sb.store.root, "state", "show", ref, "--json");
        assert.equal(result.code, 0, result.stderr);
        assert.deepEqual(JSON.parse(result.stdout), it, `ref ${ref}`);
      }
    }
  } finally {
    sb.dispose();
  }
});

onEach("--help as the value of a flag is stored, and a criterion that mentions --help is not a help request", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([]));
    const bare = cli(sb.store.root, "state", "add", "--slug", "dashed", "--title", "t", "--acceptance=--help", "--seam=-h");
    assert.equal(bare.code, 0, bare.stderr);
    assert.equal(bare.stdout.trim(), "added 1 dashed (pending)");
    const sentence = "state add --help prints the flags";
    const prose = cli(sb.store.root, "state", "add", "--slug", "prose", "--title", "t", "--acceptance", sentence);
    assert.equal(prose.code, 0, prose.stderr);
    assert.equal(prose.stdout.trim(), "added 2 prose (pending)");
    const stored = JSON.parse(stateBytes(sb)).items;
    assert.deepEqual(stored[0].acceptance, ["--help"]);
    assert.deepEqual(stored[0].seams, ["-h"]);
    assert.deepEqual(stored[1].acceptance, [sentence]);

    const set = cli(sb.store.root, "state", "set", "dashed", "--acceptance=--help");
    assert.equal(set.code, 0, set.stderr);
    assert.doesNotMatch(set.stdout, /^mstack state set <ref>/m);
  } finally {
    sb.dispose();
  }
});

onEach("state set --acceptance on an item with exactly one criterion still names --add-acceptance", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ acceptance: ["the only one"] })]));
    const result = cli(sb.store.root, "state", "set", "1", "--acceptance", "its replacement");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /acceptance: 1 criterion\(s\) replaced with 1/);
    assert.match(result.stdout, /use --add-acceptance/);
  } finally {
    sb.dispose();
  }
});

onEach("an unknown flag is refused, naming it, on state add, state set, state show and decide, and nothing is written", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const before = stateBytes(sb);
    const decisionsBefore = readFileSync(sb.store.decisions, "utf8");
    const attempts: string[][] = [
      ["state", "add", "--slug", "x", "--title", "t", "--acceptence", "a"],
      ["state", "set", "1", "--title", "t", "--acceptence", "a"],
      ["state", "show", "1", "--josn"],
      ["decide", "--phase", "p", "--decision", "d", "--resutl", "ok"],
    ];
    for (const args of attempts) {
      const result = cli(sb.store.root, ...args);
      assert.equal(result.code, 2, args.join(" "));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /Unknown option '--(acceptence|josn|resutl)'/, args.join(" "));
    }
    assert.equal(stateBytes(sb), before);
    assert.equal(readFileSync(sb.store.decisions, "utf8"), decisionsBefore);
  } finally {
    sb.dispose();
  }
});

onEach("state show takes --json before or after the ref", (cli) => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ id: 1, slug: "alpha", extra_key: 1 }), item({ id: 2, slug: "beta" })]));
    const after = cli(sb.store.root, "state", "show", "alpha", "--json");
    const before = cli(sb.store.root, "state", "show", "--json", "alpha");
    assert.equal(before.code, 0, before.stderr);
    assert.equal(before.stdout, after.stdout);
    assert.equal(JSON.parse(before.stdout).slug, "alpha");
    // still one ref, and still an error when there is none
    const two = cli(sb.store.root, "state", "show", "--json", "alpha", "beta");
    assert.equal(two.code, 2);
    assert.equal(two.stdout, "");
    const none = cli(sb.store.root, "state", "show", "--json");
    assert.equal(none.code, 2);
    assert.match(none.stderr, /state show needs an item id or slug/);
  } finally {
    sb.dispose();
  }
});

onEach("state --help and state -h point at the subcommands and their --help, exit 0, outside a repository too", (cli) => {
  for (const flag of ["--help", "-h"]) {
    const result = cli("/tmp", "state", flag);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, "");
    for (const sub of ["list", "active", "show", "add", "set"]) assert.match(result.stdout, new RegExp(`state ${sub}`));
    assert.match(result.stdout, /state add\|set\|show --help|--help/);
  }
});
