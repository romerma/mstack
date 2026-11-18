import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as costs from "../src/costs.ts";
import { sessionEnd, sessionStart, stop, subagentStop } from "../src/hooks.ts";
import { parseState } from "../src/state.ts";
import { STORE_GITATTRIBUTES } from "../src/setup.ts";
import { item, sandbox, state, trackCurrent, type Sandbox } from "./helpers.ts";
import { readRecords } from "../src/tsv.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

// ---------------------------------------------------------------------------
// Fixtures: a fake Claude Code transcript directory
// ---------------------------------------------------------------------------

interface Fake {
  readonly dir: string;
  readonly session: string;
  readonly transcript: string;
  readonly subagents: string;
  dispose(): void;
}

/**
 * `seed` pre-creates the transcript. Real fresh sessions do not have one at
 * SessionStart (observed in every fresh session, `-p` and interactive), so the
 * default is the shape that happens; a resumed session is the seeded one.
 */
function fake(session = "11111111-2222-3333-4444-555555555555", seed = false): Fake {
  const dir = mkdtempSync(join(tmpdir(), "mstack-transcripts-"));
  const transcript = join(dir, `${session}.jsonl`);
  const subagents = join(dir, session, "subagents");
  mkdirSync(subagents, { recursive: true });
  if (seed) writeFileSync(transcript, `${JSON.stringify({ type: "user", message: { role: "user", content: "hello" } })}\n`);
  return { dir, session, transcript, subagents, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

interface U {
  input?: number;
  cw?: number;
  cr?: number;
  out?: number;
}

function assistant(id: string, model: string, u: U, extra: Record<string, unknown> = {}, at = new Date()): string {
  return `${JSON.stringify({
    type: "assistant",
    isSidechain: false,
    timestamp: at.toISOString(),
    message: {
      id,
      model,
      role: "assistant",
      content: [{ type: "text", text: "x" }],
      usage: {
        input_tokens: u.input ?? 0,
        cache_creation_input_tokens: u.cw ?? 0,
        cache_read_input_tokens: u.cr ?? 0,
        output_tokens: u.out ?? 0,
      },
    },
    ...extra,
  })}\n`;
}

function costState(models: Record<string, { i: number; cw: number; cr: number; o: number; usd: number }>): string {
  return `${JSON.stringify({
    type: "cost-state",
    totalCostUSD: Object.values(models).reduce((a, m) => a + m.usd, 0),
    modelUsage: Object.fromEntries(
      Object.entries(models).map(([k, m]) => [
        k,
        {
          inputTokens: m.i,
          outputTokens: m.o,
          cacheReadInputTokens: m.cr,
          cacheCreationInputTokens: m.cw,
          costUSD: m.usd,
        },
      ]),
    ),
  })}\n`;
}

function active(box: Sandbox, slug = "storage-layer"): void {
  box.writeState(state([item({ slug, status: "in_progress" })]));
  trackCurrent(box);
}

const rows = (box: Sandbox) => readRecords(box.store.costs);
const bytes = (path: string) => readFileSync(path);
const marksFile = (box: Sandbox) => join(costs.marksDir(box.store) as string, "costs-marks.jsonl");

/** Start a session the way the SessionStart hook does, then hand back the input every hook gets. */
function begin(box: Sandbox, f: Fake) {
  const input = { cwd: box.store.root, session_id: f.session, transcript_path: f.transcript };
  sessionStart(input);
  return input;
}

/** Force a flush that ignores the "nothing changed" shortcut, so the delta arithmetic is what is tested. */
function forceFlush(box: Sandbox, session: string): void {
  const found = costs.readSessions(marksFile(box)).find((x) => x.session === session);
  assert.ok(found, "session has marks");
  costs.flushSession(box.store, found, marksFile(box));
}

const SONNET = "claude-sonnet-x";
const HAIKU = "claude-haiku-x";

// ---------------------------------------------------------------------------
// A1/A2: the table
// ---------------------------------------------------------------------------

test("setup creates costs.tsv with the agreed columns and a .gitattributes that unions the three tables", () => {
  const box = sandbox();
  try {
    const header = readFileSync(box.store.costs, "utf8").split("\n")[0];
    assert.equal(
      header,
      "ts\trun\ttarget\trole\tagent_id\tmodel\tinput\tcache_write\tcache_read\toutput\tmessages\tcost_usd\tsource",
    );
    const attrs = readFileSync(join(box.store.dir, ".gitattributes"), "utf8");
    assert.equal(attrs, STORE_GITATTRIBUTES);
    for (const file of ["costs.tsv", "ledger.tsv", "decisions.tsv"]) {
      assert.match(attrs, new RegExp(`^${file.replace(".", "\\.")} merge=union$`, "m"));
    }
    // And git agrees, which is the only reading that matters.
    const out = execFileSync("git", ["check-attr", "merge", ".mstack/costs.tsv", ".mstack/ledger.tsv", ".mstack/decisions.tsv"], {
      cwd: box.store.root,
      encoding: "utf8",
    });
    assert.equal(out.split("\n").filter((l) => l.endsWith("merge: union")).length, 3, out);
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// A3: marks and the flush
// ---------------------------------------------------------------------------

test("marks live under git's own path for mstack/, in a plain repo and in a linked worktree", () => {
  const box = sandbox();
  try {
    const spawned = (cwd: string) =>
      execFileSync("git", ["rev-parse", "--git-path", "mstack"], { cwd, encoding: "utf8" }).trim();
    const fromGit = resolve(box.store.root, spawned(box.store.root));
    assert.equal(costs.marksDir(box.store), fromGit);
    assert.ok(!(costs.marksDir(box.store) as string).includes(`${join(box.store.root, ".mstack")}`));

    execFileSync("git", ["branch", "wt-branch"], { cwd: box.store.root });
    const wt = join(box.store.root, "..", `${box.store.root.split("/").pop()}-wt`);
    execFileSync("git", ["worktree", "add", "-q", wt, "wt-branch"], { cwd: box.store.root });
    try {
      mkdirSync(join(wt, ".mstack"), { recursive: true });
      const wtStore = { ...box.store, root: wt, dir: join(wt, ".mstack") };
      assert.equal(costs.marksDir(wtStore), resolve(wt, spawned(wt)));
      assert.notEqual(costs.marksDir(wtStore), costs.marksDir(box.store), "a worktree has its own marks");
    } finally {
      rmSync(wt, { recursive: true, force: true });
    }
  } finally {
    box.dispose();
  }
});

test("SessionStart writes a mark at the transcript's current size; a repeat for the same item adds nothing", () => {
  const box = sandbox();
  const f = fake(undefined, true);
  try {
    active(box);
    const input = begin(box, f);
    const lines = readFileSync(marksFile(box), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.deepEqual(
      { run: lines[0].run, offset: lines[0].offset, slug: lines[0].slug, path: lines[0].transcript_path },
      {
        run: `${f.session}@${statSync(f.transcript).size}`,
        offset: statSync(f.transcript).size,
        slug: "storage-layer",
        path: f.transcript,
      },
    );
    sessionStart(input); // resume / compact: same session, same item
    assert.equal(readFileSync(marksFile(box), "utf8").trim().split("\n").length, 1);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("Stop appends a mark only when the active item changed, and attributes each stretch to its own item", () => {
  const box = sandbox();
  const f = fake();
  try {
    box.writeState(state([item({ slug: "alpha", id: 1, status: "in_progress" }), item({ slug: "beta", id: 2 })]));
    trackCurrent(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10, cr: 100, out: 5 }));

    const before = bytes(marksFile(box));
    stop(input);
    assert.deepEqual(bytes(marksFile(box)), before, "same item: no mark, no write");

    box.writeState(
      state([item({ slug: "alpha", id: 1, status: "done" }), item({ slug: "beta", id: 2, status: "in_progress" })]),
    );
    stop(input);
    assert.equal(readFileSync(marksFile(box), "utf8").trim().split("\n").length, 2, "item changed: one mark");

    appendFileSync(f.transcript, assistant("m2", SONNET, { input: 20, cr: 200, out: 7 }));
    sessionEnd(input);

    const got = rows(box).map((r) => [r["target"], r["role"], r["input"], r["cache_read"], r["output"]]);
    assert.deepEqual(got, [
      ["alpha", "main", "10", "100", "5"],
      ["beta", "main", "20", "200", "7"],
    ]);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("a flush counts each message.id once, skips sidechain lines and what came before the mark, and flushing twice changes nothing", () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    // Usage that predates the mark belongs to nobody this run owns.
    appendFileSync(f.transcript, assistant("old", SONNET, { input: 999, out: 999 }));
    const input = begin(box, f);

    // One response, three content blocks, the same usage on each.
    for (let i = 0; i < 3; i += 1) appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10, cw: 20, cr: 300, out: 4 }));
    appendFileSync(f.transcript, assistant("m2", HAIKU, { input: 1, out: 2 }));
    appendFileSync(f.transcript, assistant("side", SONNET, { input: 5000 }, { isSidechain: true }));
    appendFileSync(f.transcript, assistant("syn", "<synthetic>", { input: 7000 }));
    appendFileSync(f.transcript, "this line is not json at all \"usage\"\n");

    sessionEnd(input);
    const first = rows(box);
    const sonnet = first.find((r) => r["model"] === SONNET);
    const haiku = first.find((r) => r["model"] === HAIKU);
    assert.deepEqual(
      [sonnet?.["input"], sonnet?.["cache_write"], sonnet?.["cache_read"], sonnet?.["output"], sonnet?.["messages"]],
      ["10", "20", "300", "4", "1"],
      "three repeats of one message.id are one message; sidechain, synthetic and pre-mark usage are not counted",
    );
    assert.deepEqual([haiku?.["input"], haiku?.["output"]], ["1", "2"]);
    assert.equal(first.length, 2, "one row per model");

    const snapshot = bytes(box.store.costs);
    forceFlush(box, f.session);
    forceFlush(box, f.session);
    assert.deepEqual(bytes(box.store.costs), snapshot, "a second flush wrote something");

    // New usage after the flush adds a delta row and nothing else.
    appendFileSync(f.transcript, assistant("m3", SONNET, { input: 3, out: 1 }));
    sessionEnd(input);
    const delta = rows(box).slice(first.length);
    assert.equal(delta.length, 1);
    assert.deepEqual([delta[0]?.["input"], delta[0]?.["output"], delta[0]?.["messages"]], ["3", "1", "1"]);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("subagent transcripts are scanned, with the role taken from meta.json and no double count against the parent", () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10, out: 5 }));

    const later = new Date(Date.now() + 5_000);
    writeFileSync(
      join(f.subagents, "agent-abc123.jsonl"),
      assistant("s1", HAIKU, { input: 4, cw: 40, out: 2 }, { isSidechain: true }, later) +
        assistant("s1", HAIKU, { input: 4, cw: 40, out: 2 }, { isSidechain: true }, later),
    );
    writeFileSync(join(f.subagents, "agent-abc123.meta.json"), JSON.stringify({ agentType: "mstack:reviewer" }));
    writeFileSync(
      join(f.subagents, "agent-nometa.jsonl"),
      assistant("s2", HAIKU, { input: 1 }, { isSidechain: true }, later),
    );

    sessionEnd(input);
    const sub = rows(box).filter((r) => r["agent_id"] !== "(none)");
    const reviewer = sub.find((r) => r["agent_id"] === "abc123");
    assert.equal(reviewer?.["role"], "reviewer", "mstack: prefix stripped, role from meta.json");
    assert.deepEqual([reviewer?.["input"], reviewer?.["cache_write"], reviewer?.["messages"]], ["4", "40", "1"]);
    assert.equal(sub.find((r) => r["agent_id"] === "nometa")?.["role"], "subagent");
    assert.equal(rows(box).find((r) => r["role"] === "main")?.["input"], "10", "the parent's row has no subagent usage");

    const snapshot = bytes(box.store.costs);
    forceFlush(box, f.session);
    assert.deepEqual(bytes(box.store.costs), snapshot);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("a session that never reached SessionEnd is settled by the next SessionStart", () => {
  const box = sandbox();
  const crashed = fake("aaaaaaaa-0000-0000-0000-000000000001");
  const next = fake("bbbbbbbb-0000-0000-0000-000000000002");
  try {
    active(box);
    begin(box, crashed);
    appendFileSync(crashed.transcript, assistant("m1", SONNET, { input: 12, out: 3 }));
    // no SessionEnd: the process was killed
    assert.equal(rows(box).length, 0);

    begin(box, next);
    const got = rows(box);
    assert.equal(got.length, 1);
    assert.deepEqual([got[0]?.["input"], got[0]?.["run"]?.startsWith("aaaaaaaa")], ["12", true]);
  } finally {
    crashed.dispose();
    next.dispose();
    box.dispose();
  }
});

test("mstack cost flushes the live session before it reads", () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 42, out: 1 }));
    const out = spawnSync(BIN, ["cost", "storage-layer", "--json"], { cwd: box.store.root, encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr);
    assert.equal(JSON.parse(out.stdout).total.input, 42);
  } finally {
    f.dispose();
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// A4: reconciliation
// ---------------------------------------------------------------------------

test("cost-state reconciles the transcript sum: an unattributed row per model carries the difference and the real cost", () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10, cw: 100, cr: 1000, out: 50 }));
    // cost-state counts a compaction the transcript never recorded.
    appendFileSync(
      f.transcript,
      costState({
        [SONNET]: { i: 15, cw: 130, cr: 1400, o: 80, usd: 1.5 },
        [HAIKU]: { i: 2, cw: 0, cr: 0, o: 9, usd: 0.01 },
      }),
    );
    sessionEnd(input);

    const un = rows(box).filter((r) => r["role"] === "unattributed");
    assert.equal(un.length, 2);
    const s = un.find((r) => r["model"] === SONNET);
    assert.deepEqual(
      [s?.["input"], s?.["cache_write"], s?.["cache_read"], s?.["output"], s?.["cost_usd"], s?.["source"], s?.["messages"]],
      ["5", "30", "400", "30", "1.5", "cost-state", "(none)"],
    );
    // Transcript rows plus unattributed rows equal cost-state, per model.
    for (const [model, want] of [[SONNET, [15, 130, 1400, 80]], [HAIKU, [2, 0, 0, 9]]] as const) {
      const mine = rows(box).filter((r) => r["model"] === model);
      const sum = (c: string) => mine.reduce((a, r) => a + Number(r[c] === "(none)" ? 0 : r[c]), 0);
      assert.deepEqual([sum("input"), sum("cache_write"), sum("cache_read"), sum("output")], want, model);
    }

    const snapshot = bytes(box.store.costs);
    forceFlush(box, f.session);
    assert.deepEqual(bytes(box.store.costs), snapshot, "reconciling twice wrote something");

    // --resume: the same file, a cumulative cost-state. Only the growth is new.
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 15, cw: 130, cr: 1400, o: 85, usd: 1.75 }, [HAIKU]: { i: 2, cw: 0, cr: 0, o: 9, usd: 0.01 } }));
    sessionEnd(input);
    const growth = rows(box).slice(rows(box).length - 1);
    assert.deepEqual(
      [growth[0]?.["model"], growth[0]?.["output"], growth[0]?.["input"], growth[0]?.["cost_usd"]],
      [SONNET, "5", "0", "0.25"],
    );
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("a transcript that exceeds cost-state never produces a negative or a minus sign", () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 500, out: 500 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 100, cw: 0, cr: 0, o: 100, usd: 0.5 } }));
    sessionEnd(input);
    const text = readFileSync(box.store.costs, "utf8");
    for (const r of rows(box)) {
      for (const c of ["input", "cache_write", "cache_read", "output"]) assert.ok(Number(r[c]) >= 0, `${c}: ${r[c]}`);
    }
    // The only dash in the file is the sentinel's parentheses' neighbour: none at all.
    assert.ok(!/\t-/.test(text), "a bare '-' cell would be rewritten by cell()");
    assert.equal(rows(box).find((r) => r["role"] === "unattributed")?.["input"], "0");
  } finally {
    f.dispose();
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// A5: SubagentStop requires a fresh report
// ---------------------------------------------------------------------------

function agentTranscript(f: Fake, id: string, startedAt: Date): string {
  const path = join(f.subagents, `agent-${id}.jsonl`);
  writeFileSync(
    path,
    `${JSON.stringify({ type: "user", isSidechain: true, timestamp: startedAt.toISOString(), message: { role: "user", content: "x" } })}\n`,
  );
  return path;
}

const contextOf = (json: string | null) =>
  json === null ? null : (JSON.parse(json).hookSpecificOutput.additionalContext as string);

test("SubagentStop catches a later-round reviewer that wrote nothing, because round one's report still exists", () => {
  const box = sandbox();
  const f = fake();
  try {
    box.writeState(state([item({ status: "reviewing" })]));
    const report = join(box.store.progress, "review_storage-layer.md");
    writeFileSync(report, "# Review\n\nRound one, APPROVED with notes.\n");
    const startedAt = new Date(Date.now() - 60_000);
    // The round-1 report is older than this subagent: it is not this subagent's.
    utimesSync(report, new Date(startedAt.getTime() - 120_000), new Date(startedAt.getTime() - 120_000));
    const path = agentTranscript(f, "r2", startedAt);

    const stale = subagentStop({ cwd: box.store.root, agent_type: "mstack:reviewer", agent_transcript_path: path });
    assert.match(contextOf(stale) ?? "", /older than the subagent/);

    // Writing a report during the run satisfies it.
    writeFileSync(join(box.store.progress, "review_storage-layer_r2.md"), "# Review r2\n\nAPPROVED. Nothing is open after the second round.\n");
    assert.equal(subagentStop({ cwd: box.store.root, agent_type: "mstack:reviewer", agent_transcript_path: path }), null);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("SubagentStop derives the transcript path when agent_transcript_path is empty, and stays open when there is none", () => {
  const box = sandbox();
  const f = fake();
  try {
    box.writeState(state([item({ status: "reviewing" })]));
    const report = join(box.store.progress, "review_storage-layer.md");
    writeFileSync(report, "# Review\n\nRound one, APPROVED with notes.\n");
    const startedAt = new Date(Date.now() + 60_000); // the agent started after the report was written
    agentTranscript(f, "derived", startedAt);

    const input = {
      cwd: box.store.root,
      agent_type: "mstack:reviewer",
      agent_transcript_path: "",
      transcript_path: f.transcript,
      agent_id: "derived",
    };
    assert.match(contextOf(subagentStop(input)) ?? "", /older than the subagent/, "derived from transcript_path + agent_id");

    // No transcript anywhere: there is no start time, so the old answer stands.
    assert.equal(subagentStop({ cwd: box.store.root, agent_type: "mstack:reviewer", agent_transcript_path: "" }), null);
    assert.equal(
      subagentStop({ cwd: box.store.root, agent_type: "mstack:reviewer", agent_transcript_path: join(f.dir, "gone.jsonl") }),
      null,
    );
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("SubagentStop writes no cost rows", () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10 }));
    writeFileSync(join(box.store.progress, "impl_storage-layer.md"), "# Impl\n\nFiles touched: src/storage.ts\n");
    const path = agentTranscript(f, "w", new Date(Date.now() - 60_000));
    subagentStop({ ...input, agent_type: "mstack:implementer", agent_id: "w", agent_transcript_path: path });
    assert.equal(rows(box).length, 0);
  } finally {
    f.dispose();
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// A6: mstack cost, record_costs
// ---------------------------------------------------------------------------

function appendRow(box: Sandbox, cells: Record<string, string>): void {
  const header = readFileSync(box.store.costs, "utf8").split("\n")[0]?.split("\t") ?? [];
  const defaults: Record<string, string> = {
    ts: "2026-01-01T00:00:00.000Z",
    run: "s@0",
    target: "storage-layer",
    role: "main",
    agent_id: "(none)",
    model: SONNET,
    input: "0",
    cache_write: "0",
    cache_read: "0",
    output: "0",
    messages: "1",
    cost_usd: "(none)",
    source: "transcript",
  };
  appendFileSync(box.store.costs, `${header.map((h) => cells[h] ?? defaults[h]).join("\t")}\n`);
}

test("mstack cost prints tokens by role, review rounds through roundOf and verifier-failed rows", () => {
  const box = sandbox();
  try {
    active(box);
    appendRow(box, { role: "main", input: "100", output: "10" });
    appendRow(box, { role: "reviewer", agent_id: "a1", input: "50", output: "5", model: HAIKU });
    appendRow(box, { role: "unattributed", input: "1", cost_usd: "0.5", source: "cost-state" });
    appendRow(box, { target: "(none)", role: "main", input: "7" });
    for (const f of ["review_storage-layer.md", "review_storage-layer_r2.md", "review_storage-layer_r2-security.md", "review_storage-layer_r3-security.md"]) {
      writeFileSync(join(box.store.progress, f), "# Review\n\nsomething substantial enough\n");
    }
    const sha = box.sha;
    for (const verdict of ["verifier-failed", "verifier-failed", "test-verified"]) {
      execFileSync(BIN, ["ledger", "record", "storage-layer", sha, verdict, "--evidence", "tests/x.test.ts passes", "--verifier", "reviewer"], {
        cwd: box.store.root,
      });
    }

    const run = (...args: string[]) => spawnSync(BIN, ["cost", ...args], { cwd: box.store.root, encoding: "utf8" });
    const byRole = run("storage-layer");
    assert.equal(byRole.status, 0, byRole.stderr);
    assert.match(byRole.stdout, /^role\s+input\s+cache_write/m);
    assert.match(byRole.stdout, /^main\s+100\b/m);
    assert.match(byRole.stdout, /^reviewer\s+50\b/m);
    assert.match(byRole.stdout, /review rounds: 3/);
    assert.match(byRole.stdout, /verifier-failed rows: 2/);
    assert.ok(!byRole.stdout.includes("7"), "the (none) item's row is not storage-layer's");

    const json = JSON.parse(run("storage-layer", "--by", "model", "--json").stdout);
    assert.deepEqual(
      json.rows.map((r: { key: string; input: number }) => [r.key, r.input]).sort(),
      [[HAIKU, 50], [SONNET, 101]],
    );
    assert.equal(json.total.cost_usd, 0.5);
    assert.equal(json.review_rounds, 3);
    assert.equal(json.verifier_failed, 2);

    const byItem = JSON.parse(run("--by", "item", "--json").stdout);
    const mine = byItem.rows.find((r: { key: string }) => r.key === "storage-layer");
    assert.deepEqual([mine.review_rounds, mine.verifier_failed], [3, 2]);
    assert.ok(byItem.rows.some((r: { key: string }) => r.key === "(none)"));

    assert.equal(run("nope").status, 2);
    assert.equal(run("storage-layer", "--by", "colour").status, 2);
  } finally {
    box.dispose();
  }
});

test("rules.record_costs: false turns every write off, and anything that is not a boolean is an error", () => {
  const box = sandbox();
  const f = fake();
  try {
    box.writeState(state([item({ status: "in_progress" })], { rules: { record_costs: false } }));
    trackCurrent(box);
    assert.equal(parseState(box.store.state).rules.record_costs, false);

    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10 }));
    stop(input);
    sessionEnd(input);
    costs.flushAll(box.store);
    assert.equal(rows(box).length, 0);
    assert.throws(() => readFileSync(marksFile(box)), "no marks file either");
    const out = spawnSync(BIN, ["cost"], { cwd: box.store.root, encoding: "utf8" });
    assert.equal(out.status, 0);
    assert.match(out.stderr, /record_costs is false/);

    for (const bad of ["false", 0, null, "no"]) {
      box.writeState(state([item({ status: "in_progress" })], { rules: { record_costs: bad } }));
      assert.throws(() => parseState(box.store.state), /record_costs must be true or false/, String(bad));
    }
    box.writeState(state([item({ status: "in_progress" })]));
    assert.equal(parseState(box.store.state).rules.record_costs, true, "absent means on");
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("the session-end hook is wired: hooks.json declares it and the cli dispatches it silently", () => {
  const hooks = JSON.parse(readFileSync(join(dirname(BIN), "..", "hooks", "hooks.json"), "utf8")).hooks;
  const entry = hooks.SessionEnd?.[0]?.hooks?.[0];
  assert.deepEqual(entry?.args, ["hook", "session-end"]);
  assert.ok(entry.timeout <= 10, "short timeout");

  const box = sandbox();
  const f = fake();
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 9 }));
    const r = spawnSync(BIN, ["hook", "session-end"], {
      cwd: box.store.root,
      encoding: "utf8",
      input: JSON.stringify({ ...input, hook_event_name: "SessionEnd", reason: "other" }),
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    assert.equal(rows(box)[0]?.["input"], "9");
  } finally {
    f.dispose();
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// A7: isolation and budget
// ---------------------------------------------------------------------------

test("a cost layer that throws never changes what another hook says", () => {
  const box = sandbox();
  const f = fake();
  const other = fake("cccccccc-0000-0000-0000-000000000003");
  try {
    // current.md left as the template with an item active: the gate is red, so
    // the Stop hook has real output to be disturbed.
    box.writeState(state([item({ status: "in_progress" })]));
    // Establish the baseline output with a healthy cost layer.
    const healthyStart = sessionStart({ cwd: box.store.root });
    const healthyStop = stop({ cwd: box.store.root, session_id: f.session, transcript_path: f.transcript });

    // A leftover session that needs flushing, and a costs.tsv that cannot be appended to.
    begin(box, other);
    appendFileSync(other.transcript, assistant("m1", SONNET, { input: 10 }));
    rmSync(box.store.costs);
    mkdirSync(box.store.costs);
    assert.throws(() => costs.flushAll(box.store), "the fault is real: the flush itself throws");

    const brokenStart = sessionStart({ cwd: box.store.root, session_id: f.session, transcript_path: f.transcript });
    assert.equal(brokenStart, healthyStart, "SessionStart output changed because the flush threw");

    // The marks directory is a file, so a mark cannot be written either.
    const dir = costs.marksDir(box.store) as string;
    rmSync(dir, { recursive: true, force: true });
    writeFileSync(dir, "not a directory");
    const brokenStop = stop({ cwd: box.store.root, session_id: "dddddddd", transcript_path: f.transcript });
    assert.match(healthyStop ?? "", /gate is red/, "the baseline has real output to disturb");
    assert.equal(brokenStop, healthyStop, "Stop output changed because the mark failed");
    assert.equal(sessionEnd({ cwd: box.store.root, session_id: other.session }), null);
  } finally {
    f.dispose();
    other.dispose();
    box.dispose();
  }
});

test("hook paths stay within budget on a 50 MB transcript", () => {
  const box = sandbox();
  const f = fake(undefined, true);
  try {
    active(box);
    const input = begin(box, f);

    // ~50 MB: assistant turns with usage, plus the bulky tool_result lines that
    // dominate a real transcript and carry no usage at all.
    const fd = openSync(f.transcript, "a");
    const filler = `${JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "z".repeat(20_000) }] } })}\n`;
    let n = 0;
    while (statSync(f.transcript).size < 50 * 1024 * 1024) {
      for (let i = 0; i < 100; i += 1) {
        writeSync(fd, assistant(`msg_${n}`, n % 7 === 0 ? HAIKU : SONNET, { input: 3, cw: 10, cr: 5000, out: 200 }));
        writeSync(fd, assistant(`msg_${n}`, n % 7 === 0 ? HAIKU : SONNET, { input: 3, cw: 10, cr: 5000, out: 200 }));
        n += 1;
        if (i % 5 === 0) writeSync(fd, filler);
      }
    }
    closeSync(fd);
    assert.ok(statSync(f.transcript).size >= 50 * 1024 * 1024);

    const time = (fn: () => void): number => {
      const t = performance.now();
      fn();
      return performance.now() - t;
    };

    // Stop: a stat and a compare. It must not read the transcript at all, so the
    // size of the file cannot matter. A read and parse of these 50 MB measured 25 to
    // 35 ms for item 67, under the 50 ms margin of the whole-hook comparison, so the claim is
    // carried by the two in-process timings, each the worst of three so that a read
    // made only on the first Stop counts as well:
    // - `onStopMs`: the mark check alone, the only part of the hook given the path.
    // - `stopPathMs`: the whole Stop hook except the gate, which `stop_hook_active`
    //   skips, so a read added anywhere else on the Stop path counts.
    // Neither starts a child process, so outside load barely moves them.
    //
    // `stopMs - bare` is the whole hook, gate included, with the transcript against
    // without one: a budget, not a detector of a small read. The gate spawns git,
    // and outside load can add seconds to any one run of it, so each side is the
    // best of five runs, taken in turn: load only ever adds time, the fastest run
    // is the one it added least to, and work done on every Stop is in the fastest
    // run too. Taking the sides in turn gives both the same load and the same
    // place after the 50 MB write.
    const onStopMs = Math.max(...[1, 2, 3].map(() => time(() => costs.onStop(box.store, input))));
    const stopPathMs = Math.max(...[1, 2, 3].map(() => time(() => stop({ ...input, stop_hook_active: true }))));
    const withTranscript: number[] = [];
    const without: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      withTranscript.push(time(() => stop(input)));
      without.push(time(() => stop({ cwd: box.store.root })));
    }
    const stopMs = Math.min(...withTranscript);
    const bare = Math.min(...without);
    const runs = (ms: number[]) => ms.map((m) => m.toFixed(1)).join(",");
    // SessionEnd: the one place the transcript is read, streamed from the mark.
    const endMs = time(() => sessionEnd(input));
    const again = time(() => sessionEnd(input));

    console.log(
      `budget: transcript=${(statSync(f.transcript).size / 1048576).toFixed(1)}MB messages=${n} onStop=${onStopMs.toFixed(2)}ms stop(no gate)=${stopPathMs.toFixed(2)}ms stop(hook)=${stopMs.toFixed(1)}ms of [${runs(withTranscript)}] stop(no transcript)=${bare.toFixed(1)}ms of [${runs(without)}] session-end=${endMs.toFixed(0)}ms repeat=${again.toFixed(1)}ms`,
    );
    assert.equal(rows(box).reduce((a, r) => a + Number(r["messages"]), 0), n, "every message counted once");
    assert.ok(onStopMs < 20, `the Stop mark check took ${onStopMs}ms`);
    assert.ok(stopPathMs < 20, `the Stop hook without its gate took ${stopPathMs}ms`);
    assert.ok(stopMs - bare < 50, `Stop with a 50 MB transcript took ${stopMs}ms against ${bare}ms without one, the best of five runs each`);
    assert.ok(endMs < 2_500, `SessionEnd flush took ${endMs}ms against a 5 s hook timeout`);
    assert.ok(again < 100, `an unchanged re-flush took ${again}ms`);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("the flush stays within budget on a 50 MB transcript made of nothing but assistant turns", () => {
  const box = sandbox();
  const f = fake(undefined, true);
  try {
    active(box);
    const input = begin(box, f);
    // The worst case for the parser: every line is one it has to JSON.parse.
    const fd = openSync(f.transcript, "a");
    let n = 0;
    while (statSync(f.transcript).size < 50 * 1024 * 1024) {
      const text = "w".repeat(400);
      for (let i = 0; i < 500; i += 1) {
        writeSync(fd, assistant(`dense_${n}`, SONNET, { input: 3, cw: 10, cr: 5000, out: 200 }).replace('"x"', JSON.stringify(text)));
        n += 1;
      }
    }
    closeSync(fd);
    const t = performance.now();
    sessionEnd(input);
    const ms = performance.now() - t;
    console.log(`budget (dense): transcript=${(statSync(f.transcript).size / 1048576).toFixed(1)}MB messages=${n} session-end=${ms.toFixed(0)}ms`);
    assert.equal(rows(box).reduce((a, r) => a + Number(r["messages"]), 0), n);
    assert.ok(ms < 2_500, `SessionEnd flush took ${ms}ms against a 5 s hook timeout`);
  } finally {
    f.dispose();
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// Round 2
// ---------------------------------------------------------------------------

const sum = (rs: Record<string, string>[], col: string) => rs.reduce((a, r) => a + (r[col] === "(none)" ? 0 : Number(r[col])), 0);

test("a single-turn session whose transcript appears after SessionStart still gets main rows that reconcile", () => {
  const box = sandbox();
  const f = fake(); // no transcript on disk at SessionStart, as in every fresh session
  try {
    active(box);
    const input = begin(box, f);
    const mark = JSON.parse(readFileSync(marksFile(box), "utf8").trim().split("\n")[0] as string);
    assert.equal(mark.offset, 0, "a missing transcript is a mark at offset 0, not no mark");

    // One turn, and no Stop hook ever runs (`--max-turns 1`, `error_max_turns`).
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10, cw: 100, cr: 1000, out: 50 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 12, cw: 130, cr: 1400, o: 60, usd: 0.5 } }));
    sessionEnd(input);

    const got = rows(box);
    assert.deepEqual(
      got.filter((r) => r["role"] === "main").map((r) => [r["input"], r["cache_write"], r["cache_read"], r["output"]]),
      [["10", "100", "1000", "50"]],
      "the first turn is main, not unattributed",
    );
    assert.deepEqual([sum(got, "input"), sum(got, "cache_write"), sum(got, "cache_read"), sum(got, "output")], [12, 130, 1400, 60]);
    assert.equal(sum(got, "cost_usd"), 0.5);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("SessionEnd marks a session nothing marked before, so it is never silently dropped", () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 7, out: 3 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 7, cw: 0, cr: 0, o: 3, usd: 0.1 } }));
    // No SessionStart ran and no Stop did: there is not one mark anywhere.
    assert.throws(() => readFileSync(marksFile(box)));
    sessionEnd({ cwd: box.store.root, session_id: f.session, transcript_path: f.transcript });
    const got = rows(box);
    assert.equal(got.find((r) => r["role"] === "main")?.["input"], "7");
    assert.equal(sum(got, "cost_usd"), 0.1);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("a session that crashed in its first turn is settled by the next SessionStart", () => {
  const box = sandbox();
  const crashed = fake("eeeeeeee-0000-0000-0000-000000000005");
  const next = fake("ffffffff-0000-0000-0000-000000000006", true);
  try {
    active(box);
    begin(box, crashed); // transcript absent at this point
    appendFileSync(crashed.transcript, assistant("m1", SONNET, { input: 5, out: 2 }));
    begin(box, next);
    assert.equal(rows(box).find((r) => r["role"] === "main")?.["input"], "5");
  } finally {
    crashed.dispose();
    next.dispose();
    box.dispose();
  }
});

test("a session flushed on one branch and resumed on another does not double count once the branches merge", () => {
  const box = sandbox();
  const f = fake();
  try {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: box.store.root, encoding: "utf8" }).trim();
    active(box);
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "--abbrev-ref", "HEAD");

    git("checkout", "-q", "-b", "feat/a");
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 100, out: 10 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 110, cw: 0, cr: 0, o: 11, usd: 1 } }));
    sessionEnd(input);
    git("add", "-A");
    git("commit", "-q", "-m", "costs on a");

    // Back on the base branch, which has none of those rows: resume, use more, end.
    git("checkout", "-q", base);
    assert.equal(rows(box).length, 0, "the other branch's rows are not in this checkout");
    sessionStart(input);
    appendFileSync(f.transcript, assistant("m2", SONNET, { input: 50, out: 5 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 165, cw: 0, cr: 0, o: 16, usd: 1.5 } }));
    sessionEnd(input);
    git("add", "-A");
    git("commit", "-q", "-m", "costs on base");
    git("merge", "-q", "--no-edit", "feat/a");

    const merged = rows(box);
    assert.deepEqual(
      [sum(merged, "input"), sum(merged, "output"), sum(merged, "cost_usd")],
      [165, 16, 1.5],
      "the merged table equals what the session really used and cost",
    );
    const out = JSON.parse(spawnSync(BIN, ["cost", "--json"], { cwd: box.store.root, encoding: "utf8" }).stdout);
    assert.equal(out.total.input, 165);
    assert.equal(out.total.cost_usd, 1.5);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("cost_usd goes to an item only when the whole session worked on it; a session that spanned items is its own line", () => {
  const box = sandbox();
  const f = fake();
  const solo = fake("99999999-0000-0000-0000-000000000009");
  try {
    box.writeState(state([item({ slug: "alpha", id: 1, status: "in_progress" }), item({ slug: "beta", id: 2 })]));
    trackCurrent(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10, out: 1 }));
    box.writeState(state([item({ slug: "alpha", id: 1, status: "done" }), item({ slug: "beta", id: 2, status: "in_progress" })]));
    stop(input); // the item changed: a second mark
    appendFileSync(f.transcript, assistant("m2", SONNET, { input: 30, out: 3 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 40, cw: 0, cr: 0, o: 4, usd: 2 } }));
    sessionEnd(input);

    const soloInput = begin(box, solo); // beta only, for its whole life
    appendFileSync(solo.transcript, assistant("s1", SONNET, { input: 5, out: 1 }));
    appendFileSync(solo.transcript, costState({ [SONNET]: { i: 5, cw: 0, cr: 0, o: 1, usd: 0.25 } }));
    sessionEnd(soloInput);

    const byItem = costs.summarize(box.store, "item");
    const get = (k: string) => byItem.find((r) => r.key === k);
    assert.deepEqual([get("alpha")?.input, get("alpha")?.cost_usd], [10, null], "alpha has tokens and no cost");
    assert.deepEqual([get("beta")?.input, get("beta")?.cost_usd], [35, 0.25], "beta is charged only the session that was all beta");
    assert.deepEqual([get(costs.MULTI)?.input, get(costs.MULTI)?.cost_usd], [0, 2], "the spanning session's cost, whole, on its own line");
    assert.equal(costs.total(byItem).cost_usd, 2.25, "the column still sums to real spend");

    const text = spawnSync(BIN, ["cost"], { cwd: box.store.root, encoding: "utf8" }).stdout;
    assert.match(text, /^multi-item sessions\s/m);
  } finally {
    f.dispose();
    solo.dispose();
    box.dispose();
  }
});

test("prune re-reads the marks file under its lock, so a mark written after the caller's snapshot survives", () => {
  const box = sandbox();
  const old = fake("00000000-aaaa-0000-0000-000000000010", true);
  const live = fake("00000000-bbbb-0000-0000-000000000011", true);
  try {
    active(box);
    const file = marksFile(box);
    mkdirSync(dirname(file), { recursive: true });
    // A settled session whose transcript is gone and past the grace period: this is what makes prune rewrite at all.
    const longAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const lines = [
      { run: `${old.session}@0`, session: old.session, transcript_path: join(old.dir, "gone.jsonl"), offset: 0, slug: null, ts: longAgo },
      { session: old.session, ended: true, size: 1, ts: longAgo },
    ];
    writeFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(""));

    costs.prune(file, () => {
      // Exactly where a snapshot-then-rewrite would already have read the file.
      appendFileSync(
        file,
        `${JSON.stringify({ run: `${live.session}@0`, session: live.session, transcript_path: live.transcript, offset: 0, slug: "storage-layer", ts: new Date().toISOString() })}\n`,
      );
    });
    const left = costs.readSessions(file).map((x) => x.session);
    assert.deepEqual(left, [live.session], "the old session is pruned and the concurrent mark is kept");
  } finally {
    old.dispose();
    live.dispose();
    box.dispose();
  }
});

test("the flushed totals survive a prune, so a pruned-then-resumed session is not written twice", () => {
  const box = sandbox();
  const f = fake(undefined, true);
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 10, out: 1 }));
    sessionEnd(input);
    const before = rows(box).length;
    // A session whose transcript is gone beside it, so that prune really rewrites the file.
    const longAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    appendFileSync(
      marksFile(box),
      `${JSON.stringify({ run: "old@0", session: "old", transcript_path: join(f.dir, "gone.jsonl"), offset: 0, slug: null, ts: longAgo })}\n${JSON.stringify({ session: "old", ended: true, size: 1, ts: longAgo })}\n`,
    );
    costs.prune(marksFile(box));
    assert.deepEqual(costs.readSessions(marksFile(box)).map((x) => x.session), [f.session], "the rewrite happened");
    forceFlush(box, f.session);
    assert.equal(rows(box).length, before);
    assert.ok(Object.keys(costs.readSessions(marksFile(box))[0]?.flushed ?? {}).length > 0);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("GIT_DIR is honoured: the marks directory is whatever git says, with it set", () => {
  const box = sandbox();
  const elsewhere = mkdtempSync(join(tmpdir(), "mstack-gitdir-"));
  const saved = process.env["GIT_DIR"];
  try {
    execFileSync("git", ["init", "-q", "--bare", elsewhere]);
    process.env["GIT_DIR"] = elsewhere;
    const spawned = execFileSync("git", ["rev-parse", "--git-path", "mstack"], { cwd: box.store.root, encoding: "utf8", env: { ...process.env } }).trim();
    assert.equal(costs.marksDir(box.store), resolve(box.store.root, spawned));
    assert.equal(costs.marksDir(box.store), join(elsewhere, "mstack"));
  } finally {
    if (saved === undefined) delete process.env["GIT_DIR"];
    else process.env["GIT_DIR"] = saved;
    rmSync(elsewhere, { recursive: true, force: true });
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// Round 3
// ---------------------------------------------------------------------------

/** Make every record in the marks file look as if it was written `days` ago. */
function ageMarks(box: Sandbox, days: number): void {
  const file = marksFile(box);
  const past = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const aged = readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => ({ ...JSON.parse(l), ts: past }));
  writeFileSync(file, aged.map((l) => `${JSON.stringify(l)}\n`).join(""));
}

test("a session resumed after its marks were more than 14 days old is not written twice", () => {
  const box = sandbox();
  const f = fake();
  const other = fake("12121212-0000-0000-0000-000000000012", true);
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 100, out: 10 }));
    const later = new Date(Date.now() + 5_000);
    writeFileSync(join(f.subagents, "agent-sub1.jsonl"), assistant("s1", HAIKU, { input: 40, out: 4 }, { isSidechain: true }, later));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 110, cw: 0, cr: 0, o: 11, usd: 1 }, [HAIKU]: { i: 40, cw: 0, cr: 0, o: 4, usd: 0.2 } }));
    sessionEnd(input);

    ageMarks(box, 20);
    begin(box, other); // another session's start runs prune
    assert.ok(
      costs.readSessions(marksFile(box)).some((x) => x.session === f.session && Object.keys(x.flushed).length > 0),
      "the transcript still exists, so its flushed totals are kept",
    );

    // --resume: same file, cumulative cost-state.
    appendFileSync(f.transcript, assistant("m2", SONNET, { input: 50, out: 5 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 160, cw: 0, cr: 0, o: 16, usd: 1.5 }, [HAIKU]: { i: 40, cw: 0, cr: 0, o: 4, usd: 0.2 } }));
    sessionStart(input);
    sessionEnd(input);

    const got = rows(box);
    assert.deepEqual([sum(got, "input"), sum(got, "output"), sum(got, "cost_usd")], [200, 20, 1.7]);
    assert.equal(got.filter((r) => r["agent_id"] === "sub1").length, 1, "the subagent is not re-emitted");
  } finally {
    f.dispose();
    other.dispose();
    box.dispose();
  }
});

test("a session is multi-item only when two real items carried usage; a trailing or leading (none) stretch is not an item", () => {
  const box = sandbox();
  const mk = (n: number) => fake(`aaaa000${n}-0000-0000-0000-00000000000${n}`);
  const [one, two, three] = [mk(1), mk(2), mk(3)];
  const twoItems = (a: string, b: string) => state([item({ slug: "alpha", id: 1, status: a }), item({ slug: "beta", id: 2, status: b })]);
  try {
    // 1. Works alpha, closes it in the last turn: the Stop after leaves a trailing (none) mark.
    box.writeState(twoItems("in_progress", "pending"));
    trackCurrent(box);
    const a = begin(box, one);
    appendFileSync(one.transcript, assistant("a1", SONNET, { input: 70, out: 7 }));
    box.writeState(twoItems("done", "pending"));
    stop(a);
    appendFileSync(one.transcript, costState({ [SONNET]: { i: 70, cw: 0, cr: 0, o: 7, usd: 0.7 } }));
    sessionEnd(a);

    // 2. Starts with no item, then picks alpha.
    box.writeState(twoItems("done", "pending"));
    const b = begin(box, two);
    appendFileSync(two.transcript, assistant("b1", SONNET, { input: 10, out: 1 }));
    box.writeState(twoItems("in_progress", "pending"));
    stop(b);
    appendFileSync(two.transcript, assistant("b2", SONNET, { input: 90, out: 9 }));
    appendFileSync(two.transcript, costState({ [SONNET]: { i: 100, cw: 0, cr: 0, o: 10, usd: 1 } }));
    sessionEnd(b);

    // 3. Real usage on alpha and on beta.
    const c = begin(box, three);
    appendFileSync(three.transcript, assistant("c1", SONNET, { input: 20, out: 2 }));
    box.writeState(twoItems("done", "in_progress"));
    stop(c);
    appendFileSync(three.transcript, assistant("c2", SONNET, { input: 30, out: 3 }));
    appendFileSync(three.transcript, costState({ [SONNET]: { i: 50, cw: 0, cr: 0, o: 5, usd: 2 } }));
    sessionEnd(c);

    const usd = (session: string) =>
      rows(box)
        .filter((r) => r["run"]?.startsWith(session) && r["cost_usd"] !== "(none)")
        .map((r) => [r["target"], Number(r["cost_usd"])]);
    assert.deepEqual(usd(one.session), [["alpha", 0.7]], "closing the item in the last turn keeps its cost on it");
    assert.deepEqual(usd(two.session), [["alpha", 1]], "a (none) stretch before the item is not a second item");
    assert.deepEqual(usd(three.session), [[costs.MULTI, 2]], "alpha and beta both carried usage");

    // Tokens stay per stretch: session 2's first ten tokens are (none)'s.
    const tokens = (session: string, target: string) =>
      sum(rows(box).filter((r) => r["run"]?.startsWith(session) && r["target"] === target), "input");
    assert.equal(tokens(two.session, "(none)"), 10);
    assert.equal(tokens(two.session, "alpha"), 90);
    assert.equal(costs.total(costs.summarize(box.store, "item")).cost_usd, 3.7, "the column still sums to real spend");
  } finally {
    one.dispose();
    two.dispose();
    three.dispose();
    box.dispose();
  }
});

test("a session with no real item carrying usage puts its cost on (none)", () => {
  const box = sandbox();
  const f = fake();
  try {
    box.writeState(state([]));
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 5, out: 1 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 5, cw: 0, cr: 0, o: 1, usd: 0.3 } }));
    sessionEnd(input);
    const withCost = rows(box).filter((r) => r["cost_usd"] !== "(none)");
    assert.deepEqual(withCost.map((r) => [r["target"], r["cost_usd"]]), [["(none)", "0.3"]]);
  } finally {
    f.dispose();
    box.dispose();
  }
});

test("a hook killed while it waits on a leftover lock leaves no rows that the next flush writes again", { timeout: 30_000 }, async () => {
  const box = sandbox();
  const f = fake();
  try {
    active(box);
    const input = begin(box, f);
    appendFileSync(f.transcript, assistant("m1", SONNET, { input: 100, out: 10 }));
    appendFileSync(f.transcript, costState({ [SONNET]: { i: 100, cw: 0, cr: 0, o: 10, usd: 1 } }));
    // A lock left by a process that died: nothing will ever release it.
    writeFileSync(`${marksFile(box)}.lock`, "");

    const child = spawn(BIN, ["hook", "session-end"], { cwd: box.store.root, stdio: ["pipe", "ignore", "ignore"] });
    child.stdin.end(JSON.stringify({ ...input, hook_event_name: "SessionEnd", reason: "other" }));
    await new Promise((r) => setTimeout(r, 1000)); // inside the 2 s wait for the lock
    child.kill("SIGKILL");
    await new Promise((r) => child.once("exit", r));

    assert.equal(rows(box).length, 0, "nothing is written before the lock that protects the record is held");

    const out = spawnSync(BIN, ["cost", "--json"], { cwd: box.store.root, encoding: "utf8" });
    const total = JSON.parse(out.stdout).total;
    assert.deepEqual([total.input, total.output, total.cost_usd], [100, 10, 1], "counted once, not twice");
  } finally {
    f.dispose();
    box.dispose();
  }
});
