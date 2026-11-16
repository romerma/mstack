// Child process for the withLock tests in tsv.test.ts. It takes the lock on a
// file, journals entering and leaving, and holds until its release file exists.
//
// Two optional arguments use the `step` seam of withLock. `blockAt` names a step
// at which this process stops until `<release>.step` exists; `signal` names a step
// whose first occurrence is journalled. Both journal "<name> at <step>", so a test
// can wait for a process to be at a known point instead of sleeping.
import { appendFileSync, existsSync } from "node:fs";

import { withLock } from "../src/tsv.ts";

const [file, journal, name, timeoutMs, release, blockAt = "", signal = ""] = process.argv.slice(2) as [
  string, string, string, string, string, string?, string?,
];
const pause = new Int32Array(new SharedArrayBuffer(4));
const seen = new Set<string>();

function step(at: string): void {
  if (at !== blockAt && at !== signal) return;
  if (seen.has(at)) return;
  seen.add(at);
  appendFileSync(journal, `${name} at ${at}\n`);
  if (at !== blockAt) return;
  const deadline = Date.now() + 20_000;
  while (!existsSync(`${release}.step`) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);
}

withLock(
  file,
  () => {
    appendFileSync(journal, `${name} enter\n`);
    const deadline = Date.now() + 10_000;
    while (!existsSync(release) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);
    appendFileSync(journal, `${name} leave\n`);
  },
  { timeoutMs: Number(timeoutMs), step },
);
