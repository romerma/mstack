// Child process for the stale-break race test in tsv.test.ts. It waits for a
// shared instant, takes the lock, checks from inside that the lock file still
// carries its own pid, and journals the interval it was inside.
//
// One process runs many rounds so that the cost of booting a runtime is paid
// once and the waiters of every round start within a millisecond of each other.
import { appendFileSync, readFileSync } from "node:fs";

import { withLock } from "../src/tsv.ts";

const [file, journal, name, rounds, start, roundMs, holdMs] = process.argv.slice(2) as [
  string, string, string, string, string, string, string,
];
const pause = new Int32Array(new SharedArrayBuffer(4));
const wall = () => performance.timeOrigin + performance.now();
const ownsLock = () => {
  try {
    return readFileSync(`${file}.lock`, "utf8").startsWith(`${process.pid} `);
  } catch {
    return false;
  }
};

for (let round = 0; round < Number(rounds); round++) {
  const at = Number(start) + round * Number(roundMs);
  while (Date.now() < at - 2) Atomics.wait(pause, 0, 0, 1);
  while (Date.now() < at) { /* spin the last two milliseconds */ }
  try {
    withLock(file, () => {
      const enter = wall();
      const ownedOnEntry = ownsLock();
      const until = enter + Number(holdMs);
      while (wall() < until) { /* hold */ }
      const ownedOnExit = ownsLock();
      appendFileSync(journal, `${round} ${name} ${enter} ${wall()} ${ownedOnEntry && ownedOnExit}\n`);
    }, { timeoutMs: 5_000 });
  } catch (error) {
    appendFileSync(journal, `${round} ${name} THREW ${(error as Error).message}\n`);
  }
}
