// Child process for item 42's task 3.3 tests: `runMutation` on the store at
// <store root>, as `verify --mutation` runs it, in a process (and, spawned
// detached, a process group) of its own, so that a test can signal it alone
// or with its group.
// argv: <store root> <journal> <blockAt> <release> [timeout ms]
//
// Each step appends `at <step>` to the journal and, at the step named
// `blockAt`, stops synchronously (Atomics.wait, so no signal handler runs)
// until the file `<release>` exists. Every line the run prints is appended as
// `out <line>`, and the exit code as `exit <code>`.
import { appendFileSync, existsSync } from "node:fs";

import { runMutation } from "../src/mutation-run.ts";
import { storeAt } from "../src/paths.ts";

const [root, journal, blockAt, release, timeout = "60000"] = process.argv.slice(2) as [string, string, string, string, string?];
const pause = new Int32Array(new SharedArrayBuffer(4));

function step(at: string): void {
  appendFileSync(journal, `at ${at}\n`);
  if (at !== blockAt) return;
  const deadline = Date.now() + 30_000;
  while (!existsSync(release) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);
}

const code = await runMutation(storeAt(root), { timeoutMs: Number(timeout), step, out: (line) => appendFileSync(journal, `out ${line}\n`) });
appendFileSync(journal, `exit ${code}\n`);
process.exitCode = code;
