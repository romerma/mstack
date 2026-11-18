// usage: node scripts/load/run.mjs <bun|node> <out-dir> [watchdog-seconds=820] [round=-] [slot=x]
// Runs the whole suite once on one runtime, from the repository root, under a SIGKILL watchdog
// on its process group, and appends one row to <out-dir>/results.tsv (full output in <out-dir>/logs/).
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const [runtime, out, watchdog = "820", round = "-", slot = "x"] = process.argv.slice(2);
if ((runtime !== "bun" && runtime !== "node") || out === undefined) {
  console.error("usage: node scripts/load/run.mjs <bun|node> <out-dir> [watchdog-seconds] [round] [slot]");
  process.exit(2);
}
const cmd = runtime === "bun"
  ? ["bun", ["test", "./tests"]]
  : ["node", ["--disable-warning=ExperimentalWarning", "--experimental-strip-types", "--test", "--test-reporter=spec", "tests/*.test.ts"]];

mkdirSync(join(out, "logs"), { recursive: true });
const started = new Date();
const loadStart = loadavg()[0].toFixed(1);
let text = "";
const child = spawn(cmd[0], cmd[1], { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", (d) => (text += d));
child.stderr.on("data", (d) => (text += d));
let killed = false;
let psAtKill = "";
const timer = setTimeout(() => {
  killed = true;
  psAtKill = spawnSync("ps", ["-Ao", "pid,ppid,etime,command"], { encoding: "utf8" }).stdout
    .split("\n").filter((l) => /\b(bun|node)\b/.test(l)).join("\n");
  try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
}, Number(watchdog) * 1000);
// The suite is in a process group of its own, so a signal to this process does not reach it.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
    process.exit(1);
  });
}

child.on("close", () => {
  clearTimeout(timer);
  const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
  const log = `${round}_${slot}_${runtime}_${started.getTime()}.log`;
  writeFileSync(join(out, "logs", log), clean + (killed ? `\n--- ps at kill ---\n${psAtKill}\n` : ""));
  const last = (re) => [...clean.matchAll(re)].pop()?.[1] ?? "?";
  const names = runtime === "bun"
    ? clean.matchAll(/^\(fail\) (.*?)(?: \[[\d.]+m?s\])?$/gm)
    : clean.matchAll(/^\s*✖ (.*?)(?: \([\d.]+ms\))?$/gm);
  const failing = [...new Set([...names].map((m) => m[1]))].filter((n) => !/^failing tests:/.test(n));
  const row = [
    round,
    slot,
    runtime,
    started.toISOString().slice(11, 19),
    loadStart,
    loadavg()[0].toFixed(1),
    ((Date.now() - started.getTime()) / 1000).toFixed(0),
    runtime === "bun" ? last(/^\s*(\d+) pass$/gm) : last(/^ℹ pass (\d+)/gm),
    runtime === "bun" ? last(/^\s*(\d+) fail$/gm) : last(/^ℹ fail (\d+)/gm),
    killed ? "killed" : "-",
    failing.join(" | "),
    log,
  ];
  appendFileSync(join(out, "results.tsv"), `${row.join("\t")}\n`);
  console.log(row.join("\t"));
});
