// Child process for the withLock tests in tsv.test.ts. It takes the lock on a
// file, journals entering and leaving, and holds until its release file exists.
import { appendFileSync, existsSync } from "node:fs";

import { withLock } from "../src/tsv.ts";

const [file, journal, name, timeoutMs, release] = process.argv.slice(2) as [string, string, string, string, string];
const pause = new Int32Array(new SharedArrayBuffer(4));

withLock(
  file,
  () => {
    appendFileSync(journal, `${name} enter\n`);
    const deadline = Date.now() + 10_000;
    while (!existsSync(release) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);
    appendFileSync(journal, `${name} leave\n`);
  },
  { timeoutMs: Number(timeoutMs) },
);
