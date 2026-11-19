// Child process for item 42's group 2 tests, in the style of lock-holder.ts.
// argv: <store root> <journal> <phase> <blockAt> <release> [nogit]
//
// Phase `acquire` stages the active item's revert set (prepareRun), takes the
// lock (acquireLock) and sweeps what earlier runs left (sweepStale), as a run
// does before its first write. Phase `run` goes on: applyRevert, the step
// `obligations-running` (nothing runs), then restoreFromLock, of only the
// entries the revert wrote when it stopped; it exits 3 when the restore failed.
// Each phase appends `at <step>` to the journal at each step and, at the step
// named `blockAt`, stops until the file `<release>` exists, so a test can
// SIGKILL it or race it at a known point. A refusal is journalled as
// `refused <reason>` and exits 2.
//
// With `nogit`, PATH is set before the restore to a directory whose `git`
// writes `<journal>.git-ran`; the journal then says whether that file existed
// right after the restore, and, as a canary, after one call of git().
import { appendFileSync, chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

import { git } from "../src/git.ts";
import { revertSet } from "../src/mutation.ts";
import { acquireLock, prepareRun, sweepStale } from "../src/mutation-lock.ts";
import { applyRevert, restoreFromLock } from "../src/mutation-tree.ts";
import { storeAt } from "../src/paths.ts";
import { measureStart, resolveCommit } from "../src/size.ts";
import { activeItem } from "../src/state.ts";

const [root, journal, phase, blockAt, release, flag = ""] = process.argv.slice(2) as [string, string, string, string, string, string?];
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
if (phase !== "run") quit(2, `refused unknown phase ${phase}`);

const reverted = applyRevert(store, lock, step);
if (!reverted.ok) appendFileSync(journal, `blocked ${reverted.path}: ${reverted.reason}\n`);
step("obligations-running");
const marker = `${journal}.git-ran`;
if (flag === "nogit") {
  const bin = `${journal}.bin`;
  mkdirSync(bin);
  writeFileSync(`${bin}/git`, `#!/bin/sh\n/usr/bin/touch '${marker}'\nexit 1\n`);
  chmodSync(`${bin}/git`, 0o755);
  process.env["PATH"] = bin;
}
const restored = restoreFromLock(store, lock, { step, ...(reverted.ok ? {} : { entries: reverted.written }) });
if (flag === "nogit") {
  appendFileSync(journal, `git ran during the restore: ${existsSync(marker)}\n`);
  git(store, ["--version"]);
  appendFileSync(journal, `canary: git ran after one git(): ${existsSync(marker)}\n`);
}
quit(restored.failed.length > 0 ? 3 : 0, `restored ${JSON.stringify(restored)}`);
