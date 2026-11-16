import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync, closeSync, existsSync, linkSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { UserError } from "../src/paths.ts";
import { parseState, updateState } from "../src/state.ts";
import { item, sandbox, state } from "./helpers.ts";

const MSTACK = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

const HOLDER = join(dirname(fileURLToPath(import.meta.url)), "state-holder.ts");
const RUNTIME_FLAGS = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
  ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
  : [];
const SPAWN_TEST = { timeout: 60_000 };

interface Exit {
  readonly code: number | null;
  readonly stderr: string;
}

/**
 * Run several `mstack` commands against one store at the same moment.
 *
 * Fan-out is several processes writing one `state.json`, so the commands are
 * started together and awaited together. Running them one after another would
 * pass on any implementation, including one with no serialisation at all.
 */
function together(cwd: string, commands: readonly (readonly string[])[]): { done: Promise<Exit[]>; kill(): void } {
  const children: ChildProcess[] = [];
  const exits = commands.map(
    (args) =>
      new Promise<Exit>((resolve) => {
        const child = spawn(MSTACK, [...args], { cwd, stdio: ["ignore", "ignore", "pipe"] });
        children.push(child);
        let stderr = "";
        child.stderr!.on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.on("close", (code) => resolve({ code, stderr }));
      }),
  );
  return {
    done: Promise.all(exits),
    kill() {
      for (const child of children) child.kill("SIGKILL");
    },
  };
}

test("concurrent state add calls each land in state.json", { timeout: 60_000 }, async () => {
  const sb = sandbox();
  sb.writeState(state([]));
  const writers = together(
    sb.store.root,
    Array.from({ length: 12 }, (_, i) => ["state", "add", "--slug", `unit-${i}`, "--title", `Unit ${i}`, "--acceptance", `criterion ${i}`]),
  );
  try {
    const exits = await writers.done;
    for (const exit of exits) assert.equal(exit.code, 0, exit.stderr);

    // Every writer said it succeeded, so every item has to be there. Twelve
    // exit 0 with eight items on disk is four units of work that the queue
    // will never show anyone.
    const items = (JSON.parse(readFileSync(sb.store.state, "utf8")) as { items: { id: number; slug: string }[] }).items;
    assert.equal(items.length, 12, `12 writers exited 0 and ${items.length} item(s) are on disk`);
    assert.equal(new Set(items.map((i) => i.slug)).size, 12, "each writer's item must be there");
    assert.equal(new Set(items.map((i) => i.id)).size, 12, "and no two items may share an id");
  } finally {
    writers.kill();
    sb.dispose();
  }
});

const FORK = "which storage format do we commit to";

test("concurrent add, set and decide --resolves all land", SPAWN_TEST, async () => {
  const sb = sandbox();
  const items = Array.from({ length: 4 }, (_, i) => item({ id: i + 1, slug: `old-${i}`, title: `Old ${i}` }));
  items.push(item({ id: 5, slug: "forked", title: "Forked", status: "specifying", decision_required: FORK }));
  sb.writeState(state(items));
  const writers = together(sb.store.root, [
    ...Array.from({ length: 6 }, (_, i) => ["state", "add", "--slug", `new-${i}`, "--title", `New ${i}`, "--acceptance", "x"]),
    ...Array.from({ length: 4 }, (_, i) => ["state", "set", `old-${i}`, "--title", `Renamed ${i}`]),
    [
      "decide", "--phase", "design", "--resolves", "forked", "--decision", "versioned envelope",
      "--why", "a consumer must be able to detect a breaking change",
      "--evidence", "acceptance bullet 2 of the item, quoted in state.json", "--result", "version field required",
    ],
  ]);
  try {
    for (const exit of await writers.done) assert.equal(exit.code, 0, exit.stderr);
    const after = parseState(sb.store.state);
    assert.equal(after.items.length, 11);
    assert.equal(new Set(after.items.map((i) => i.id)).size, 11);
    for (let i = 0; i < 4; i++) assert.equal(after.items.find((x) => x.slug === `old-${i}`)?.title, `Renamed ${i}`);
    assert.ok(after.items.find((x) => x.slug === "forked")?.decision_resolved, "the decision pointer must land");
  } finally {
    writers.kill();
    sb.dispose();
  }
});

test("a writer queued behind a live holder works on what the holder wrote", SPAWN_TEST, async () => {
  const sb = sandbox();
  sb.writeState(state([]));
  const release = join(sb.store.root, "release");
  const holder = spawn(process.execPath, [...RUNTIME_FLAGS, HOLDER, sb.store.state, release, "held"], { stdio: "ignore" });
  let writers: ReturnType<typeof together> | undefined;
  try {
    const deadline = Date.now() + 20_000;
    while (!existsSync(`${release}.ready`) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    assert.ok(existsSync(`${release}.ready`), "the holder never took the lock");
    writers = together(sb.store.root, [["state", "add", "--slug", "queued", "--title", "Queued"]]);
    // Long enough for the writer to start and, if it reads before it holds the
    // lock, to read the file as it is now; short of the 2 s the lock waits.
    await new Promise((r) => setTimeout(r, 700));
    writeFileSync(release, "");
    for (const exit of await writers.done) assert.equal(exit.code, 0, exit.stderr);
    const slugs = parseState(sb.store.state).items.map((i) => i.slug).sort();
    assert.deepEqual(slugs, ["held", "queued"], "the queued writer must not overwrite the holder's item");
  } finally {
    writers?.kill();
    holder.kill("SIGKILL");
    sb.dispose();
  }
});

test("a live holder past the timeout fails the writer with a UserError naming the lock", { timeout: 20_000 }, () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const before = readFileSync(sb.store.state, "utf8");
    // Owned by this very process, so it reads as a live holder.
    writeFileSync(`${sb.store.state}.lock`, `${process.pid} 00000000-0000-4000-8000-000000000000\n`);
    assert.throws(
      () => updateState(sb.store.state, (s) => { s.items[0]!.title = "changed"; }),
      (error) => error instanceof UserError && error.message.includes("state.json.lock"),
    );
    assert.equal(readFileSync(sb.store.state, "utf8"), before, "a refused writer must write nothing");
  } finally {
    sb.dispose();
  }
});

test("a write replaces the file by rename: a new inode, and an open reader keeps the old content", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const oldIno = statSync(sb.store.state, { bigint: true }).ino;
    const old = readFileSync(sb.store.state, "utf8");
    const reader = openSync(sb.store.state, "r");
    try {
      updateState(sb.store.state, (s) => { s.items[0]!.title = "x".repeat(5000); });
      assert.notEqual(statSync(sb.store.state, { bigint: true }).ino, oldIno, "the target was written in place");
      const buffer = Buffer.alloc(old.length + 100);
      const n = readSync(reader, buffer, 0, buffer.length, 0);
      assert.equal(buffer.subarray(0, n).toString("utf8"), old, "a reader of the old file must see all of it");
    } finally {
      closeSync(reader);
    }
  } finally {
    sb.dispose();
  }
});

test("a hard link to state.json keeps the old content, so the target is never opened for writing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const old = readFileSync(sb.store.state, "utf8");
    const link = join(sb.store.root, "state-link.json");
    linkSync(sb.store.state, link);
    updateState(sb.store.state, (s) => { s.items[0]!.title = "changed"; });
    assert.equal(readFileSync(link, "utf8"), old, "an in-place write would have changed the linked file too");
    assert.equal(parseState(sb.store.state).items[0]!.title, "changed");
  } finally {
    sb.dispose();
  }
});

test("a failing change writes nothing and leaves no lock or temporary file", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const before = readFileSync(sb.store.state, "utf8");
    const dir = dirname(sb.store.state);
    const names = readdirSync(dir).sort();
    assert.throws(() => updateState(sb.store.state, () => { throw new UserError("no"); }), UserError);
    assert.equal(readFileSync(sb.store.state, "utf8"), before);
    assert.deepEqual(readdirSync(dir).sort(), names);
  } finally {
    sb.dispose();
  }
});

test("a successful write leaves no lock or temporary file, and a leftover one does not block it", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const dir = dirname(sb.store.state);
    // What a writer killed between the write and the rename leaves: a partial
    // temporary file under the same prefix.
    writeFileSync(join(dir, "state.json.tmp-1-0"), "{ \"trunc");
    const names = readdirSync(dir).sort();
    updateState(sb.store.state, (s) => { s.items[0]!.title = "changed"; });
    updateState(sb.store.state, (s) => { s.items[0]!.title = "changed again"; });
    assert.equal(parseState(sb.store.state).items[0]!.title, "changed again");
    assert.deepEqual(readdirSync(dir).sort(), names, "a write must leave nothing of its own behind");
  } finally {
    sb.dispose();
  }
});

test("keys the CLI does not know survive a write, on the state, rules and every item", () => {
  const sb = sandbox();
  try {
    sb.writeState(state(
      [item({ id: 1, slug: "a", title: "A", owner: "ana" }), item({ id: 2, slug: "b", title: "B", labels: ["x", { y: 1 }] })],
      { team: { name: "core" }, rules: { one_active_item: true, record_costs: true, custom_rule: 3 } },
    ));
    updateState(sb.store.state, (s) => { s.items[0]!.title = "A2"; });
    const raw = JSON.parse(readFileSync(sb.store.state, "utf8")) as Record<string, any>;
    assert.deepEqual(raw.team, { name: "core" });
    assert.equal(raw.rules.custom_rule, 3);
    assert.equal(raw.items[0].owner, "ana");
    assert.deepEqual(raw.items[1].labels, ["x", { y: 1 }]);
    assert.equal(raw.items[0].title, "A2");
  } finally {
    sb.dispose();
  }
});

test("state set keeps an unknown key on the item it changes and on the one it does not", SPAWN_TEST, async () => {
  const sb = sandbox();
  try {
    sb.writeState(state(
      [item({ id: 1, slug: "a", title: "A", owner: "ana" }), item({ id: 2, slug: "b", title: "B", owner: "bo" })],
      { team: "core" },
    ));
    const [exit] = await together(sb.store.root, [["state", "set", "a", "--title", "A2"]]).done;
    assert.equal(exit!.code, 0, exit!.stderr);
    const raw = JSON.parse(readFileSync(sb.store.state, "utf8")) as Record<string, any>;
    assert.equal(raw.team, "core");
    assert.deepEqual(raw.items.map((i: any) => i.owner), ["ana", "bo"]);
    assert.equal(raw.items[0].title, "A2");
  } finally {
    sb.dispose();
  }
});

test("a read-only .mstack directory fails promptly with a UserError, not a hang", { timeout: 20_000 }, (t) => {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("root ignores directory permissions");
    return;
  }
  const sb = sandbox();
  const dir = dirname(sb.store.state);
  try {
    sb.writeState(state([item()]));
    chmodSync(dir, 0o555);
    const started = Date.now();
    assert.throws(
      () => updateState(sb.store.state, (s) => { s.items[0]!.title = "changed"; }),
      (error) => error instanceof UserError && /state\.json/.test(error.message),
    );
    assert.ok(Date.now() - started < 1_000, "a directory that cannot be written is not a lock to wait for");
  } finally {
    chmodSync(dir, 0o755);
    sb.dispose();
  }
});
