import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGate } from "../src/gate.ts";
import { marksDir } from "../src/costs.ts";
import { item, quiesce, sandbox, state, trackCurrent, type Sandbox } from "./helpers.ts";

/**
 * Item 54: a hook that fails leaves a line on disk, and still exits 0.
 *
 * Every test that starts a process has a timeout (spawnSync kills the child
 * itself; the async helper kills it from a timer) and none asserts on elapsed
 * time except the ones that are about the budget.
 */

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");
const LOG = "hook-errors.log";
const TIMEOUT_MS = 20_000;

interface Ran {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly ms: number;
}

function hook(cwd: string, args: readonly string[], input = ""): Ran {
  const started = Date.now();
  const r = spawnSync(BIN, ["hook", ...args], {
    cwd,
    encoding: "utf8",
    input,
    timeout: TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  if (r.error !== undefined) throw r.error;
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", ms: Date.now() - started };
}

function hookAsync(cwd: string, args: readonly string[], input = ""): Promise<Ran> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(BIN, ["hook", ...args], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        ms: Date.now() - started,
      });
    });
    child.stdin.end(input);
  });
}

const logOf = (box: Sandbox) => join(box.store.dir, LOG);

function lines(box: Sandbox): string[] {
  return existsSync(logOf(box)) ? readFileSync(logOf(box), "utf8").split("\n").filter((l) => l !== "") : [];
}

/** A hook input whose `cwd` is not a string: the handler throws a TypeError, which is a real throw out of a handler. */
const THROWING_INPUT = JSON.stringify({ cwd: 5 });

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

// ---------------------------------------------------------------------------
// Acceptance 1: an exception inside a hook appends one line
// ---------------------------------------------------------------------------

test("a hook that throws appends one line (timestamp, event, message) and exits 0", () => {
  const box = sandbox();
  try {
    const r = hook(box.store.root, ["session-start"], THROWING_INPUT);
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, "", "a hook error is never shown to the user");
    const got = lines(box);
    assert.equal(got.length, 1, `one line, got ${JSON.stringify(got)}`);
    const [ts, event, message] = (got[0] as string).split("\t");
    assert.ok(!Number.isNaN(Date.parse(ts as string)), `timestamp parses: ${ts}`);
    assert.equal(event, "session-start");
    assert.match(message as string, /string|path/i, "the message carries the error's own text");
  } finally {
    box.dispose();
  }
});

test("a cost failure that the hook fences off still reaches the log", () => {
  const box = sandbox();
  try {
    writeFileSync(box.store.state, "this is not json\n");
    const r = hook(box.store.root, ["session-end"], JSON.stringify({ session_id: "s1", transcript_path: join(box.store.root, "t.jsonl") }));
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, "");
    const got = lines(box);
    assert.equal(got.length, 1, JSON.stringify(got));
    assert.match(got[0] as string, /\tsession-end\t.*state\.json is not valid JSON/);
  } finally {
    box.dispose();
  }
});

test("session-start on an unreadable state.json logs it and says what it said before", () => {
  const box = sandbox();
  try {
    writeFileSync(box.store.state, "{ nope\n");
    const r = hook(box.store.root, ["session-start"], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    assert.match(r.stdout, /No active work item/, "output unchanged by this item");
    // Two steps of the one hook read the same file and fail on it: the text it
    // prints, and the cost recording that is fenced off after it.
    const got = lines(box);
    assert.equal(got.length, 2, JSON.stringify(got));
    assert.match(got[0] as string, /\tsession-start\tstate\.json could not be read: .*not valid JSON/);
    assert.match(got[1] as string, /\tsession-start\tcost recording: .*not valid JSON/);
  } finally {
    box.dispose();
  }
});

test("a cost row lost to a lock that a live process holds leaves a line", () => {
  const box = sandbox();
  try {
    box.writeState(state([item({ status: "in_progress" })]));
    trackCurrent(box);
    const dir = marksDir(box.store) as string;
    mkdirSync(dir, { recursive: true });
    // The test process is the live holder: the hook waits out its two seconds and the lock throws.
    writeFileSync(join(dir, "costs-marks.jsonl.lock"), `${process.pid} ${randomUUID()}\n`);
    const transcript = join(box.store.root, "t.jsonl");
    writeFileSync(transcript, "");
    const r = hook(box.store.root, ["session-end"], JSON.stringify({ session_id: "s2", transcript_path: transcript }));
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    assert.ok(r.ms < 5_000, `inside the 5 s SessionEnd budget, took ${r.ms} ms`);
    const got = lines(box);
    assert.equal(got.length, 1, JSON.stringify(got));
    assert.match(got[0] as string, /\tsession-end\t.*held by pid/);
  } finally {
    box.dispose();
  }
});

test("hook input that is not JSON is logged, and an empty stdin is not", () => {
  const box = sandbox();
  try {
    assert.equal(hook(box.store.root, ["post-edit"], "").code, 0);
    assert.equal(lines(box).length, 0, "an empty stdin is a hand-run, not a fault");
    assert.equal(hook(box.store.root, ["post-edit"], "{{{").code, 0);
    const got = lines(box);
    assert.equal(got.length, 1, JSON.stringify(got));
    assert.match(got[0] as string, /\tpost-edit\t.*not JSON/);
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// Acceptance 3: an event the CLI does not handle
// ---------------------------------------------------------------------------

test("an unknown event says so on stderr, leaves a line, and exits 0", () => {
  const box = sandbox();
  try {
    const r = hook(box.store.root, ["sesion-start"], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /unknown event 'sesion-start'/);
    assert.match(r.stderr, /session-start/, "names what is handled");
    const got = lines(box);
    assert.equal(got.length, 1, JSON.stringify(got));
    assert.match(got[0] as string, /\tsesion-start\t.*not handled/);
  } finally {
    box.dispose();
  }
});

test("a missing event is an unknown event too", () => {
  const box = sandbox();
  try {
    const r = hook(box.store.root, [], "");
    assert.equal(r.code, 0);
    assert.match(r.stderr, /unknown event/);
    assert.equal(lines(box).length, 1);
  } finally {
    box.dispose();
  }
});

test("every event the CLI handles is accepted, and the lint reads the same list", async () => {
  const { HOOK_COMMANDS } = await import("../src/hooklog.ts");
  const box = sandbox();
  try {
    for (const name of HOOK_COMMANDS) {
      const r = hook(box.store.root, [name], JSON.stringify({ cwd: box.store.root }));
      assert.equal(r.code, 0, name);
      assert.doesNotMatch(r.stderr, /unknown event/, name);
    }
    assert.equal(lines(box).length, 0, "no handled event on a healthy store logs anything");
    const real = JSON.parse(readFileSync(join(dirname(BIN), "..", "hooks", "hooks.json"), "utf8")) as {
      hooks: Record<string, { hooks: { args?: string[] }[] }[]>;
    };
    const used = Object.values(real.hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.args?.[1])));
    for (const name of used) assert.ok((HOOK_COMMANDS as readonly (string | undefined)[]).includes(name), `${name} is in the list`);
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// The log's own failure paths
// ---------------------------------------------------------------------------

test("a hook outside any store exits 0, prints nothing it did not print before, and creates no .mstack", () => {
  const dir = mkdtempSync(join(tmpdir(), "mstack-nostore-"));
  try {
    for (const name of ["session-start", "post-edit", "subagent-stop", "stop", "session-end", "pre-tool-use"]) {
      const r = hook(dir, [name], JSON.stringify({ cwd: dir }));
      assert.equal(r.code, 0, name);
      assert.equal(r.stdout, "", name);
      assert.equal(r.stderr, "", name);
    }
    const unknown = hook(dir, ["sesion-start"], JSON.stringify({ cwd: dir }));
    assert.equal(unknown.code, 0);
    assert.match(unknown.stderr, /unknown event/);
    const thrown = hook(dir, ["stop"], THROWING_INPUT);
    assert.equal(thrown.code, 0);
    assert.equal(thrown.stderr, "");
    assert.equal(existsSync(join(dir, ".mstack")), false, "a repository with no store never gets one");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a log that cannot be written never changes the exit code or the output", () => {
  const box = sandbox();
  try {
    mkdirSync(logOf(box)); // a directory where the log should be
    const r = hook(box.store.root, ["sesion-start"], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /unknown event/);
    assert.equal(r.stderr.trim().split("\n").length, 1, "the failed write adds nothing to stderr");
    const thrown = hook(box.store.root, ["stop"], THROWING_INPUT);
    assert.equal(thrown.code, 0);
    assert.equal(thrown.stderr, "");
  } finally {
    box.dispose();
  }
});

test("a store that is not writable still exits 0 and prints nothing extra", { skip: process.getuid?.() === 0 }, () => {
  const box = sandbox();
  try {
    execFileSync("chmod", ["555", box.store.dir]);
    const r = hook(box.store.root, ["stop"], THROWING_INPUT);
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, "");
    assert.equal(existsSync(logOf(box)), false);
  } finally {
    execFileSync("chmod", ["755", box.store.dir]);
    box.dispose();
  }
});

test("a message with tabs, newlines and enormous length is one bounded line of three fields", () => {
  const box = sandbox();
  try {
    const evil = `a\tb\nc\r${"x".repeat(100_000)}`;
    const r = hook(box.store.root, [evil], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    const text = readFileSync(logOf(box), "utf8");
    assert.equal(text.split("\n").length, 2, "exactly one line and its terminator");
    const fields = text.trimEnd().split("\t");
    assert.equal(fields.length, 3, JSON.stringify(fields.map((f) => f.length)));
    assert.ok(text.length < 2_000, `bounded, got ${text.length} bytes`);
    assert.ok(r.stderr.length < 2_000, `stderr bounded too, got ${r.stderr.length}`);
  } finally {
    box.dispose();
  }
});

test("two hooks failing at the same moment both leave their line", async () => {
  const box = sandbox();
  try {
    const input = JSON.stringify({ cwd: box.store.root });
    const runs = await Promise.all(
      Array.from({ length: 6 }, (_, i) => hookAsync(box.store.root, [`bad-${i}`], input)),
    );
    for (const r of runs) assert.equal(r.code, 0);
    const got = lines(box);
    assert.equal(got.length, 6, JSON.stringify(got));
    for (let i = 0; i < 6; i += 1) assert.ok(got.some((l) => l.split("\t")[1] === `bad-${i}`), `bad-${i}`);
  } finally {
    box.dispose();
  }
});

test("the log is bounded: the oldest lines are dropped and the newest kept", async () => {
  const { MAX_LINES } = await import("../src/hooklog.ts");
  const box = sandbox();
  try {
    const seeded = Array.from(
      { length: MAX_LINES * 3 },
      (_, i) => `2020-01-01T00:00:00.000Z\told-${i}\t${"m".repeat(120)}\n`,
    ).join("");
    writeFileSync(logOf(box), seeded);
    const r = hook(box.store.root, ["brand-new"], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    const got = lines(box);
    assert.ok(got.length <= MAX_LINES, `kept ${got.length} of ${MAX_LINES * 3 + 1}`);
    assert.equal((got.at(-1) as string).split("\t")[1], "brand-new", "the newest line survives");
    assert.equal((got[0] as string).split("\t")[1] === "old-0", false, "the oldest line is gone");
    assert.ok(got.some((l) => l.includes(`old-${MAX_LINES * 3 - 1}`)), "the newest old lines survive");
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// Acceptance 2: the gate
// ---------------------------------------------------------------------------

function seedLog(box: Sandbox, at: Date): void {
  writeFileSync(logOf(box), `${at.toISOString()}\tsession-end\tcost recording: boom\n`);
}

function setHistoryMtime(box: Sandbox, at: Date): void {
  utimesSync(box.store.history, at, at);
}

const warnings = (box: Sandbox) => runGate(box.store, { quiet: true }).warnings;

test("the gate warns, naming the log, when it holds lines newer than the last change to history.md", () => {
  const box = sandbox();
  try {
    setHistoryMtime(box, new Date(Date.now() - 3_600_000));
    seedLog(box, new Date(Date.now() - 60_000));
    const hit = warnings(box).filter((w) => w.includes(LOG));
    assert.equal(hit.length, 1, JSON.stringify(warnings(box)));
    assert.match(hit[0] as string, /1 hook error/);
    assert.match(hit[0] as string, /session-end/, "names the newest event");
  } finally {
    box.dispose();
  }
});

test("the gate stops warning once history.md changes after the last line", () => {
  const box = sandbox();
  try {
    seedLog(box, new Date(Date.now() - 3_600_000));
    setHistoryMtime(box, new Date(Date.now() - 60_000));
    assert.deepEqual(warnings(box).filter((w) => w.includes(LOG)), []);
  } finally {
    box.dispose();
  }
});

test("the gate counts only the lines newer than history.md", () => {
  const box = sandbox();
  try {
    const cut = new Date(Date.now() - 600_000);
    setHistoryMtime(box, cut);
    writeFileSync(
      logOf(box),
      [
        `${new Date(cut.getTime() - 5_000).toISOString()}\tstop\told`,
        `${new Date(cut.getTime() + 5_000).toISOString()}\tstop\tnew one`,
        `${new Date(cut.getTime() + 6_000).toISOString()}\tstop\tnew two`,
      ].join("\n") + "\n",
    );
    const hit = warnings(box).filter((w) => w.includes(LOG));
    assert.equal(hit.length, 1);
    assert.match(hit[0] as string, /2 hook error/);
  } finally {
    box.dispose();
  }
});

test("a gate with no log, or a log that is a directory, says nothing about it and does not fail", () => {
  const box = sandbox();
  try {
    assert.deepEqual(warnings(box).filter((w) => w.includes(LOG)), []);
    mkdirSync(logOf(box));
    const report = runGate(box.store, { quiet: true });
    assert.deepEqual(report.warnings.filter((w) => w.includes(LOG)), []);
    assert.equal(report.failed, false, JSON.stringify(report.failures));
  } finally {
    box.dispose();
  }
});

test("a warning never fails the gate", () => {
  const box = sandbox();
  try {
    seedLog(box, new Date());
    setHistoryMtime(box, new Date(Date.now() - 3_600_000));
    const report = runGate(box.store, { quiet: true });
    assert.ok(report.warnings.some((w) => w.includes(LOG)));
    assert.equal(report.failed, false, JSON.stringify(report.failures));
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// The log never dirties the tree
// ---------------------------------------------------------------------------

test("setup ignores the log, and re-running setup upgrades an older .gitignore", async () => {
  const { setup } = await import("../src/setup.ts");
  const box = sandbox();
  try {
    const ignore = join(box.store.dir, ".gitignore");
    assert.match(readFileSync(ignore, "utf8"), /^hook-errors\.log$/m);
    writeFileSync(ignore, "verification.tsv\n");
    const quiet = console.log;
    console.log = () => {};
    try {
      setup(box.store.root);
    } finally {
      console.log = quiet;
    }
    assert.match(readFileSync(ignore, "utf8"), /^hook-errors\.log$/m);
  } finally {
    box.dispose();
  }
});

test("a new store's log is not in git status", () => {
  const box = sandbox();
  try {
    quiesce(box);
    const r = hook(box.store.root, ["sesion-start"], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    assert.equal(lines(box).length, 1);
    assert.equal(git(box.store.root, "status", "--short"), "");
  } finally {
    box.dispose();
  }
});

test("a store created before this change does not show the log in git status either", () => {
  const box = sandbox();
  try {
    writeFileSync(join(box.store.dir, ".gitignore"), "verification.tsv\n");
    quiesce(box);
    const r = hook(box.store.root, ["sesion-start"], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    assert.equal(lines(box).length, 1);
    assert.equal(git(box.store.root, "status", "--short"), "", "no tracked file was edited and no log shows");
    assert.equal(statSync(logOf(box)).isFile(), true);
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

test("a failing hook stays well inside the smallest timeout in hooks.json (5 s)", () => {
  const box = sandbox();
  try {
    const r = hook(box.store.root, ["sesion-start"], JSON.stringify({ cwd: box.store.root }));
    assert.equal(r.code, 0);
    assert.ok(r.ms < 2_500, `took ${r.ms} ms`);
  } finally {
    box.dispose();
  }
});

test("appending to a store directory that does not exist creates nothing", async () => {
  const { appendHookError } = await import("../src/hooklog.ts");
  const dir = mkdtempSync(join(tmpdir(), "mstack-nostore-"));
  try {
    appendHookError(join(dir, ".mstack"), "stop", "boom");
    assert.equal(existsSync(join(dir, ".mstack")), false);
    appendHookError(null, "stop", "boom");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
