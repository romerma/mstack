// Child process for the updateState tests in state.test.ts. It runs a real
// `updateState` that adds one item, and inside the change it stops: it creates
// `<release>.ready`, then holds the state lock until `<release>` exists. A test
// uses it to put another writer behind a live holder on purpose.
import { existsSync, writeFileSync } from "node:fs";

import { updateState } from "../src/state.ts";

const [file, release, slug] = process.argv.slice(2) as [string, string, string];
const pause = new Int32Array(new SharedArrayBuffer(4));

updateState(file, (state) => {
  writeFileSync(`${release}.ready`, "");
  const deadline = Date.now() + 15_000;
  while (!existsSync(release) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);
  state.items.push({
    id: Math.max(0, ...state.items.map((i) => i.id)) + 1,
    slug,
    title: slug,
    acceptance: ["held"],
    status: "pending",
  });
});
