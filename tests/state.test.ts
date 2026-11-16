import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sandbox, state } from "./helpers.ts";

const MSTACK = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

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
