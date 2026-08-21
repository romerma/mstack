import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { all } from "../src/decisions.ts";
import { ensureHeader } from "../src/tsv.ts";
import { parseState } from "../src/state.ts";
import { sandbox, state, item, trackCurrent } from "./helpers.ts";

const MSTACK = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function mstack(cwd: string, args: readonly string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(MSTACK, [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

const FORK = "Stable public contract, or a dump we can reshape?";

test("--resolves writes the row and the pointer together", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));

    const result = mstack(sb.store.root, [
      "decide",
      "--phase",
      "design",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope",
      "--why",
      "a consumer must be able to detect a breaking change",
      "--evidence",
      "acceptance bullet 2 of the item, quoted in state.json",
      "--result",
      "version field required",
    ]);
    assert.equal(result.status, 0, result.stderr);

    // Neither half can exist alone: a pointer with no row is a claim with no
    // evidence, and a row nothing points at does not unblock the item.
    const rows = all(sb.store);
    assert.equal(rows.length, 1);
    const resolved = parseState(sb.store.state).items[0]!.decision_resolved;
    assert.equal(resolved, rows[0]!.ts, "the pointer must name the row that was just written");
  } finally {
    sb.dispose();
  }
});

test("--resolves on an item with no fork is refused, not silently accepted", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    const result = mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "something",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /carries no decision_required/);
    assert.equal(all(sb.store).length, 0, "a refused resolve must not leave a row behind");
  } finally {
    sb.dispose();
  }
});

test("--resolves naming an item that does not exist writes nothing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress", decision_required: FORK })]));
    const result = mstack(sb.store.root, ["decide", "--resolves", "nope", "--decision", "x"]);
    assert.notEqual(result.status, 0);
    assert.equal(all(sb.store).length, 0);
  } finally {
    sb.dispose();
  }
});

test("a decision without --resolves is still recorded, and unblocks nothing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress", decision_required: FORK })]));
    assert.equal(mstack(sb.store.root, ["decide", "--decision", "unrelated"]).status, 0);

    assert.equal(all(sb.store).length, 1, "every decision is worth a row");
    assert.equal(
      parseState(sb.store.state).items[0]!.decision_resolved,
      undefined,
      "only --resolves answers a fork; a bare row must not close one by accident",
    );
  } finally {
    sb.dispose();
  }
});

test("state set refuses to move an item past its open fork", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));

    const refused = mstack(sb.store.root, ["state", "set", "storage-layer", "--status", "spec_ready"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /unanswered decision/);
    assert.match(refused.stderr, /mstack decide --resolves storage-layer/, "the error must name the fix");
    assert.equal(parseState(sb.store.state).items[0]!.status, "specifying", "a refused move must not happen");

    mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope with a version field",
      "--why",
      "a consumer has to be able to detect a breaking change without asking anyone",
      "--evidence",
      "acceptance bullet 2 of the item, quoted in state.json",
      "--result",
      "version field required; adding a field is compatible, changing one is a bump",
    ]);
    const allowed = mstack(sb.store.root, ["state", "set", "storage-layer", "--status", "spec_ready"]);
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(parseState(sb.store.state).items[0]!.status, "spec_ready");
  } finally {
    sb.dispose();
  }
});

test("--force still moves it, because the gate is the authority and this is the speed bump", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));
    const forced = mstack(sb.store.root, [
      "state",
      "set",
      "storage-layer",
      "--status",
      "in_progress",
      "--force",
    ]);
    assert.equal(forced.status, 0, forced.stderr);
    // ...and the gate then says so, which is the point of having both.
    const gate = mstack(sb.store.root, ["gate"]);
    assert.notEqual(gate.status, 0);
    assert.match(gate.stdout + gate.stderr, /decision unanswered/);
  } finally {
    sb.dispose();
  }
});

/**
 * Attaching a fork, which is the direction that had no CLI at all.
 *
 * `decision_required` could only be set at `state add`, and the spec skill says
 * product forks are found by interviewing the repository during `specifying` —
 * after intake. So the plugin's headline gate could not be attached at the
 * moment its own workflow says the fork appears, short of editing state.json by
 * hand, which is how a dogfood run produced two textbook forks, answered both
 * with a plain decision row, and left the gate with no opinion.
 */
test("a fork can be attached during specifying, which is where the workflow says it is found", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying" })]));
    trackCurrent(sb);

    const attached = mstack(sb.store.root, ["state", "set", "storage-layer", "--decision-required", FORK]);
    assert.equal(attached.status, 0, attached.stderr);
    assert.equal(parseState(sb.store.state).items[0]!.decision_required, FORK);

    // Below the line, so the gate is still green...
    assert.equal(mstack(sb.store.root, ["gate"]).status, 0);
    // ...and the fork now has the opinion the field exists to have.
    const refused = mstack(sb.store.root, ["state", "set", "storage-layer", "--status", "spec_ready"]);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /unanswered decision/);
  } finally {
    sb.dispose();
  }
});

test("attaching a fork to an item already past the line is refused, and names both routes", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));

    const refused = mstack(sb.store.root, ["state", "set", "storage-layer", "--decision-required", FORK]);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /at or past the point where a fork must already be answered/);
    assert.match(refused.stderr, /--status blocked/, "the refusal has to name the way to park it");
    assert.match(refused.stderr, /--force/, "and the way to insist");
    assert.equal(
      parseState(sb.store.state).items[0]!.decision_required,
      undefined,
      "a refused attach must not have written the fork",
    );

    // The whole point of refusing: the CLI must not create a state its own gate
    // reports. Parking the item and attaching the fork is one command, and it
    // leaves the store green.
    const parked = mstack(sb.store.root, [
      "state",
      "set",
      "storage-layer",
      "--status",
      "blocked",
      "--decision-required",
      FORK,
    ]);
    assert.equal(parked.status, 0, parked.stderr);
    assert.equal(parseState(sb.store.state).items[0]!.decision_required, FORK);
    trackCurrent(sb);
    assert.equal(mstack(sb.store.root, ["gate"]).status, 0);
  } finally {
    sb.dispose();
  }
});

test("--force attaches it where it stands and says the gate will now fail", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "reviewing" })]));
    trackCurrent(sb);

    const forced = mstack(sb.store.root, ["state", "set", "1", "--decision-required", FORK, "--force"]);
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(forced.stdout, /forced: storage-layer is reviewing and now carries an unanswered fork/);
    assert.match(forced.stdout, /mstack decide --resolves storage-layer/, "and what would clear it");

    // The choice is recorded rather than implied: the command said what it was
    // creating, and the gate reports exactly that.
    const gate = mstack(sb.store.root, ["gate"]);
    assert.notEqual(gate.status, 0);
    assert.match(gate.stdout + gate.stderr, /decision unanswered/);
  } finally {
    sb.dispose();
  }
});

test("rewriting the fork drops the answer to the question it replaced", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));
    trackCurrent(sb);
    mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope with a version field",
      "--why",
      "a consumer has to be able to detect a breaking change without asking anyone",
      "--evidence",
      "acceptance bullet 2 of the item, quoted in state.json",
      "--result",
      "version field required; adding a field is compatible, changing one is a bump",
    ]);
    assert.notEqual(parseState(sb.store.state).items[0]!.decision_resolved, undefined);

    const rewritten = mstack(sb.store.root, [
      "state",
      "set",
      "storage-layer",
      "--decision-required",
      "Does the envelope carry a schema URL as well, or only a number?",
    ]);
    assert.equal(rewritten.status, 0, rewritten.stderr);
    // The row said which fork it answered. Left in place, it would answer this
    // one too: the gate matches a row on its timestamp and the slug it
    // resolves, never on the question, so a new fork would be born answered.
    assert.equal(parseState(sb.store.state).items[0]!.decision_resolved, undefined);
    const refused = mstack(sb.store.root, ["state", "set", "storage-layer", "--status", "spec_ready"]);
    assert.equal(refused.status, 2, "the new fork is unanswered, and nothing may build on it");
    assert.match(refused.stderr, /schema URL/);

    // Restating the same fork is a no-op, so an answered fork stays answered.
    const again = mstack(sb.store.root, [
      "state",
      "set",
      "storage-layer",
      "--decision-required",
      "Does the envelope carry a schema URL as well, or only a number?",
    ]);
    assert.equal(again.status, 0, again.stderr);
  } finally {
    sb.dispose();
  }
});

test("--clear decision-required drops the pointer along with the question", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));
    trackCurrent(sb);
    mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope with a version field",
      "--why",
      "a consumer has to be able to detect a breaking change without asking anyone",
      "--evidence",
      "acceptance bullet 2 of the item, quoted in state.json",
      "--result",
      "version field required; adding a field is compatible, changing one is a bump",
    ]);

    const cleared = mstack(sb.store.root, ["state", "set", "storage-layer", "--clear", "decision-required"]);
    assert.equal(cleared.status, 0, cleared.stderr);
    const after = parseState(sb.store.state).items[0]!;
    assert.equal(after.decision_required, undefined);
    assert.equal(after.decision_resolved, undefined, "a pointer to the answer of a question nobody is asking");
    assert.equal(mstack(sb.store.root, ["state", "set", "storage-layer", "--status", "spec_ready"]).status, 0);
  } finally {
    sb.dispose();
  }
});

test("the row says which fork it answers, so no other row can close it", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress", decision_required: FORK })]));

    // With the link only on the item, the pointer named a timestamp and nothing
    // more: a row about tabs versus spaces closed a fork about a public API
    // contract, because no column said what a row was about.
    mstack(sb.store.root, ["decide", "--decision", "use tabs", "--result", "tabs"]);
    const unrelated = all(sb.store)[0]!;
    assert.equal(unrelated.resolves, "", "a decision recorded without --resolves resolves nothing");

    const raw = JSON.parse(readFileSync(sb.store.state, "utf8")) as { items: Record<string, unknown>[] };
    raw.items[0]!["decision_resolved"] = unrelated.ts;
    writeFileSync(sb.store.state, JSON.stringify(raw, null, 2));

    const gate = mstack(sb.store.root, ["gate"]);
    assert.notEqual(gate.status, 0);
    assert.match(gate.stdout + gate.stderr, /no row with that timestamp resolves storage-layer/);
  } finally {
    sb.dispose();
  }
});

test("resolving a fork demands an answer that says something", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));

    // `--decision " "` plus the default `--result open` wrote a row that was a
    // timestamp and the word "open", and the gate called the fork answered.
    for (const args of [
      ["--decision", " ", "--result", "a genuine result string here"],
      ["--decision", "a real answer that is long enough"],
      ["--decision", "a real answer that is long enough", "--result", "open"],
      ["--decision", "a real answer that is long enough", "--result", "  "],
      // Long enough decision and result, but nothing behind them.
      ["--decision", "a real answer that is long enough", "--result", "a genuine result string here"],
      ["--decision", "a real answer that is long enough", "--result", "a genuine result string here", "--why", "x"],
    ]) {
      const result = mstack(sb.store.root, ["decide", "--resolves", "storage-layer", ...args]);
      assert.notEqual(result.status, 0, `accepted ${JSON.stringify(args)}`);
    }
    assert.equal(all(sb.store).length, 0, "a refused resolve must not leave a row behind");

    const ok = mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope with a version field",
      "--why",
      "a consumer has to be able to detect a breaking change without asking anyone",
      "--evidence",
      "acceptance bullet 2 of the item, quoted in state.json",
      "--result",
      "version field required; adding a field is compatible, changing one is a bump",
    ]);
    assert.equal(ok.status, 0, ok.stderr);
  } finally {
    sb.dispose();
  }
});

test("concurrent decisions do not share a timestamp, because the timestamp is the key", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));

    // Twelve concurrent calls produced eight distinct millisecond timestamps
    // before the append was serialised. Fan-out is a shipped feature, so this
    // is the designed workflow rather than a stress test, and a pointer that
    // resolved to two rows could name two contradictory answers.
    const children = Array.from({ length: 12 }, (_, i) =>
      spawnSync(MSTACK, ["decide", "--decision", `concurrent ${i}`], {
        cwd: sb.store.root,
        encoding: "utf8",
      }),
    );
    for (const child of children) assert.equal(child.status, 0, child.stderr);

    const rows = all(sb.store);
    assert.equal(rows.length, 12, "every decision must be recorded");
    assert.equal(new Set(rows.map((r) => r.ts)).size, 12, "and each must be distinguishable from the others");
    assert.ok(!existsSync(`${sb.store.decisions}.lock`), "the lock must not survive the writers");
  } finally {
    sb.dispose();
  }
});

test("a store written before the resolves column keeps its rows and gains the column", () => {
  const sb = sandbox();
  try {
    // Only ever adding a column at the end is what makes this safe. Without the
    // widening, the next append would write more cells than the header names
    // and silently misalign every row against an older store.
    writeFileSync(
      sb.store.decisions,
      "ts\tphase\tdecision\twhy\tevidence\tresult\n2026-01-01T00:00:00.000Z\tdesign\told row\tbecause\tsomewhere\tdone\n",
      "utf8",
    );
    sb.writeState(state([item({ status: "in_progress" })]));
    assert.equal(mstack(sb.store.root, ["decide", "--decision", "new row", "--result", "done"]).status, 0);

    const rows = all(sb.store);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.decision, "old row", "the pre-existing row must survive intact");
    assert.equal(rows[0]!.result, "done", "and stay in its own columns");
    assert.equal(rows[0]!.resolves, "");
    assert.equal(rows[1]!.decision, "new row");
  } finally {
    sb.dispose();
  }
});

test("a header that is not a prefix is left alone rather than guessed at", () => {
  const sb = sandbox();
  try {
    // A rename or a reorder is not a widening, and quietly guessing at one is
    // how data gets attributed to the wrong column.
    const foreign = "when\twhat\twhy\n2026-01-01\tsomething\tbecause\n";
    writeFileSync(sb.store.decisions, foreign, "utf8");
    ensureHeader(sb.store.decisions, ["ts", "phase", "decision"]);
    assert.equal(readFileSync(sb.store.decisions, "utf8"), foreign);
  } finally {
    sb.dispose();
  }
});

test("state add refuses to write what parseState would refuse to read", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([]));
    // One command used to brick the store: `state list` exited 2, the gate
    // exited 1, the status line said "unreadable", and `state set` could not
    // repair it because it parses before it writes.
    for (const slug of ["Not A Slug", "UPPER", "trailing-", "has space", "", "../escape"]) {
      const result = mstack(sb.store.root, ["state", "add", "--slug", slug, "--title", "T"]);
      assert.notEqual(result.status, 0, `accepted slug ${JSON.stringify(slug)}`);
    }
    assert.equal(mstack(sb.store.root, ["state", "list"]).status, 0, "the store must still be readable");

    assert.equal(mstack(sb.store.root, ["state", "add", "--slug", "good-slug", "--title", "T"]).status, 0);
    assert.equal(
      mstack(sb.store.root, ["state", "add", "--slug", "good-slug", "--title", "T"]).status !== 0,
      true,
      "a duplicate slug is the same class of unreadable",
    );
  } finally {
    sb.dispose();
  }
});

test("a reference is a slug, or all digits, and never a number by accident", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([
        item({ id: 1, slug: "alpha" }),
        item({ id: 2, slug: "bravo" }),
        item({ id: 3, slug: "2fa-login" }),
      ]),
    );
    // `Number.parseInt("2fa-login")` is 2, so this moved item `bravo` and
    // exited 0. `decide --resolves 2fa` attached reasoning to another item's
    // fork the same way.
    assert.equal(mstack(sb.store.root, ["state", "set", "2fa-login", "--status", "in_progress"]).status, 0);

    const items = parseState(sb.store.state).items;
    assert.equal(items.find((i) => i.slug === "2fa-login")!.status, "in_progress");
    assert.equal(items.find((i) => i.slug === "bravo")!.status, "pending", "the wrong item must not move");

    // An all-digit reference still resolves by id.
    assert.equal(mstack(sb.store.root, ["state", "set", "2", "--status", "blocked"]).status, 0);
    assert.equal(parseState(sb.store.state).items.find((i) => i.id === 2)!.status, "blocked");

    assert.notEqual(mstack(sb.store.root, ["state", "set", "nope", "--status", "in_progress"]).status, 0);
  } finally {
    sb.dispose();
  }
});

test("setup --force does not empty a populated work queue", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item(), item({ id: 2, slug: "two" })]));
    // `history.md` was protected by a literal `false`, which means the question
    // was asked and `state.json` was left out of the answer — while the ledger
    // survived, leaving verdicts pointing at items that no longer existed.
    const result = mstack(sb.store.root, ["setup", "--force"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /would delete them/);
    assert.equal(parseState(sb.store.state).items.length, 2, "the queue must survive");
  } finally {
    sb.dispose();
  }
});

test("setup --force is still allowed on an empty queue", () => {
  const sb = sandbox();
  try {
    assert.equal(mstack(sb.store.root, ["setup", "--force"]).status, 0);
  } finally {
    sb.dispose();
  }
});
