// usage: node scripts/load/table.mjs <out-dir>
// Reads <out-dir>/results.tsv (one row per suite run, written by run.mjs) and prints the runs per
// runtime, then one row per failing test name with the number of runs it failed in, per runtime.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2];
if (out === undefined) {
  console.error("usage: node scripts/load/table.mjs <out-dir>");
  process.exit(2);
}
const rows = readFileSync(join(out, "results.tsv"), "utf8").split("\n").filter((l) => l !== "").map((l) => l.split("\t"));
const runs = { bun: 0, node: 0 };
const killed = { bun: 0, node: 0 };
const red = { bun: 0, node: 0 };
const failures = new Map();
for (const [, , runtime, , , , , , fail, kill, failing] of rows) {
  runs[runtime] += 1;
  if (kill === "killed") killed[runtime] += 1;
  if (fail !== "0") red[runtime] += 1;
  for (const name of (failing ?? "").split(" | ").filter((n) => n !== "")) {
    const counts = failures.get(name) ?? { bun: 0, node: 0 };
    counts[runtime] += 1;
    failures.set(name, counts);
  }
}
console.log(`runs: bun ${runs.bun}, node ${runs.node}; red: bun ${red.bun}, node ${red.node}; killed by the watchdog: bun ${killed.bun}, node ${killed.node}`);
console.log("");
console.log(`| failing test | bun (of ${runs.bun}) | node (of ${runs.node}) |`);
console.log("|---|---|---|");
const sorted = [...failures].sort((a, b) => b[1].bun + b[1].node - (a[1].bun + a[1].node));
for (const [name, c] of sorted) console.log(`| ${name} | ${c.bun} | ${c.node} |`);
if (sorted.length === 0) console.log("| (none) | 0 | 0 |");
