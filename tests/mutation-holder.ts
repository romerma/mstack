// Child process for item 42's group 2 tests, in the style of lock-holder.ts.
// argv: <store root> <journal> <phase> <blockAt> <release>
//
// Phase `acquire` stages the active item's revert set (prepareRun), takes the
// lock (acquireLock) and sweeps what earlier runs left (sweepStale), as a run
// does before its first write. It appends `at <step>` to the journal at each
// step and, at the step named `blockAt`, stops until the file `<release>`
// exists, so a test can SIGKILL it or race it at a known point. A refusal is
// journalled as `refused <reason>` and exits 2.
import { appendFileSync, existsSync } from "node:fs";

import { revertSet } from "../src/mutation.ts";
import { acquireLock, prepareRun, sweepStale } from "../src/mutation-lock.ts";
import { storeAt } from "../src/paths.ts";
import { measureStart, resolveCommit } from "../src/size.ts";
import { activeItem } from "../src/state.ts";

const [root, journal, phase, blockAt, release] = process.argv.slice(2) as [string, string, string, string, string];
const pause = new Int32Array(new SharedArrayBuffer(4));

function step(at: string): void {
  appendFileSync(journal, `at ${at}\n`);
  if (at !== blockAt) return;
  const deadline = Date.now() + 30_000;
  while (!existsSync(release) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);
}

function quit(code: number, line: string): never {
  appendFileSync(journal, `${line}\n`);
  process.exit(code);
}

const store = storeAt(root);
const base = activeItem(store)?.base;
const commit = base === undefined ? null : resolveCommit(store, base);
const start = commit === null ? null : measureStart(store, commit).from;
if (start === null) quit(2, "refused no start");
const set = revertSet(store, start);
if (set === null) quit(2, "refused no revert set");

const prepared = prepareRun(store, start, set);
if (!prepared.ok) quit(2, `refused ${prepared.reason}`);
const lock = prepared.lock;
step("prepared");
const got = acquireLock(store, lock);
if (!got.ok) quit(2, `refused ${got.reason}`);
step("lock-written");
sweepStale(store, lock);
if (phase === "acquire") quit(0, "done");
quit(2, `refused unknown phase ${phase}`);
