import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseState } from "../src/state.ts";
import { item, sandbox, state } from "./helpers.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function run(cwd: string, args: readonly string[]): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(BIN, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { stdout, stderr: "", code: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.status ?? 1 };
  }
}

test("`state active` prints the slug alone, so command substitution works", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    const result = run(sb.store.root, ["state", "active"]);
    assert.equal(result.stdout.trim(), "storage-layer");
    assert.equal(result.code, 0);
  } finally {
    sb.dispose();
  }
});

test("with nothing active, stdout stays empty and the note goes to stderr", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "pending" })]));
    const result = run(sb.store.root, ["state", "active"]);
    // Every agent file tells agents to run this. `SLUG=$(mstack state active)`
    // must yield an empty string here, not the words "no active item".
    assert.equal(result.stdout.trim(), "");
    assert.match(result.stderr, /no active item/);
    assert.equal(result.code, 1);
  } finally {
    sb.dispose();
  }
});

test("an unknown command exits 2 and says what to run instead", () => {
  const sb = sandbox();
  try {
    const result = run(sb.store.root, ["nonsense"]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /unknown command/);
    assert.match(result.stderr, /mstack help/);
  } finally {
    sb.dispose();
  }
});

test("outside an mstack repository the error names the fix", () => {
  const result = run("/tmp", ["gate"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /mstack setup/);
});

/**
 * Everything below is `state set` as a field editor.
 *
 * It used to take `--status`, `--closed-by` and `--force` and nothing else, so
 * every other field was write-once at `state add` and a typo in a quoted
 * acceptance criterion could only be fixed by hand-editing state.json.
 */

const only = (sb: ReturnType<typeof sandbox>) => parseState(sb.store.state).items[0]!;

test("state set corrects every field state add can set", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([
        item({
          description: "the first draft of the description",
          source: "issue #4",
          verification: "npm test",
        }),
      ]),
    );
    const result = run(sb.store.root, [
      "state",
      "set",
      "storage-layer",
      "--title",
      "Atomic JSON storage, with a temp file and a rename",
      "--description",
      "the corrected description",
      "--source",
      "issue #7",
      "--verification",
      "python3 -m unittest test_storage -v",
      "--acceptance",
      "load() returns [] when the file is absent",
      "--acceptance",
      "a crash mid-write leaves the previous file intact",
      "--decision-required",
      "Is the format a public contract, or ours to reshape?",
      "--sdd",
    ]);
    assert.equal(result.code, 0, result.stderr);

    const after = only(sb);
    assert.equal(after.title, "Atomic JSON storage, with a temp file and a rename");
    assert.equal(after.description, "the corrected description");
    assert.equal(after.source, "issue #7");
    assert.equal(after.verification, "python3 -m unittest test_storage -v");
    assert.deepEqual(after.acceptance, [
      "load() returns [] when the file is absent",
      "a crash mid-write leaves the previous file intact",
    ]);
    assert.equal(after.decision_required, "Is the format a public contract, or ours to reshape?");
    assert.equal(after.sdd, true);
    assert.equal(after.status, "pending", "correcting a field is not a status move");
  } finally {
    sb.dispose();
  }
});

test("a field the item does not carry yet is added rather than refused", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const bare = only(sb);
    for (const absent of [bare.description, bare.source, bare.verification, bare.decision_required, bare.sdd]) {
      assert.equal(absent, undefined, "the fixture must start without these, or this test proves nothing");
    }

    const result = run(sb.store.root, [
      "state",
      "set",
      "1",
      "--description",
      "what this item is for",
      "--source",
      "direct request",
      "--verification",
      "npm test",
    ]);
    assert.equal(result.code, 0, result.stderr);
    const after = only(sb);
    assert.equal(after.description, "what this item is for");
    assert.equal(after.source, "direct request");
    assert.equal(after.verification, "npm test");
    assert.match(result.stdout, /description: \(unset\) -> "what this item is for"/);
  } finally {
    sb.dispose();
  }
});

test("--clear removes a field, and an empty value is refused rather than stored", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ description: "a description that is about to go", source: "issue #4" })]));

    const cleared = run(sb.store.root, ["state", "set", "1", "--clear", "description"]);
    assert.equal(cleared.code, 0, cleared.stderr);
    assert.equal(only(sb).description, undefined, "--clear must remove the key, not blank it");
    assert.equal(only(sb).source, "issue #4", "clearing one field must not touch another");

    // The trap: "" reads as "set it to nothing", and a key whose value is the
    // empty string round-trips through state.json as present-but-blank.
    const empty = run(sb.store.root, ["state", "set", "1", "--source", ""]);
    assert.equal(empty.code, 2);
    assert.match(empty.stderr, /an empty --source is not a value/);
    assert.match(empty.stderr, /--clear source/, "the refusal has to name the spelling that works");
    assert.equal(only(sb).source, "issue #4", "a refused set must not have written anything");
  } finally {
    sb.dispose();
  }
});

test("--acceptance replaces the list and --add-acceptance appends to it", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ acceptance: ["the first one", "the second one"] })]));

    const replaced = run(sb.store.root, ["state", "set", "1", "--acceptance", "the only one that survives"]);
    assert.equal(replaced.code, 0, replaced.stderr);
    assert.deepEqual(only(sb).acceptance, ["the only one that survives"]);
    // A replace that drops quoted criteria has to be visible in the output. It
    // is the one edit whose damage the gate cannot see: an empty list fails, a
    // list that lost one of two does not.
    assert.match(replaced.stdout, /acceptance: 2 criterion\(s\) replaced with 1/);
    assert.match(replaced.stdout, /dropped "the first one"/);
    assert.match(replaced.stdout, /dropped "the second one"/);

    const appended = run(sb.store.root, ["state", "set", "1", "--add-acceptance", "one more, kept alongside"]);
    assert.equal(appended.code, 0, appended.stderr);
    assert.deepEqual(only(sb).acceptance, ["the only one that survives", "one more, kept alongside"]);
  } finally {
    sb.dispose();
  }
});

test("acceptance cannot be cleared, because the gate fails an item with none", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const refused = run(sb.store.root, ["state", "set", "1", "--clear", "acceptance"]);
    assert.equal(refused.code, 2);
    assert.match(refused.stderr, /acceptance cannot be cleared/);
    assert.match(refused.stderr, /--acceptance/, "the refusal has to name what to do instead");
    assert.equal(only(sb).acceptance.length, 1, "nothing was written");
  } finally {
    sb.dispose();
  }
});

test("the slug is refused by name, because nothing that references it moves with it", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const refused = run(sb.store.root, ["state", "set", "1", "--slug", "renamed"]);
    assert.equal(refused.code, 2);
    assert.match(refused.stderr, /cannot rename a slug/);
    assert.match(refused.stderr, /ledger/, "the refusal has to say what would be orphaned");
    assert.equal(only(sb).slug, "storage-layer");
  } finally {
    sb.dispose();
  }
});

test("a set that was handed nothing to do says so instead of reporting success", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const nothing = run(sb.store.root, ["state", "set", "1"]);
    assert.equal(nothing.code, 2);
    assert.match(nothing.stderr, /nothing to set/);

    // --force on its own is not an instruction either.
    const forced = run(sb.store.root, ["state", "set", "1", "--force"]);
    assert.equal(forced.code, 2);
    assert.match(forced.stderr, /nothing to set/);
  } finally {
    sb.dispose();
  }
});

test("two instructions for one field in one command are refused, not ordered", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ description: "the one that is there now" })]));

    const both = run(sb.store.root, ["state", "set", "1", "--description", "a new one", "--clear", "description"]);
    assert.equal(both.code, 2);
    assert.match(both.stderr, /contradict each other/);
    assert.equal(only(sb).description, "the one that is there now", "neither instruction ran");

    const lists = run(sb.store.root, ["state", "set", "1", "--acceptance", "a", "--add-acceptance", "b"]);
    assert.equal(lists.code, 2);
    assert.match(lists.stderr, /cannot do both/);
    assert.deepEqual(only(sb).acceptance, ["load() returns [] when the file is absent"]);
  } finally {
    sb.dispose();
  }
});

test("--status and --closed-by keep working exactly as before", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));

    const moved = run(sb.store.root, ["state", "set", "storage-layer", "--status", "in_progress"]);
    assert.equal(moved.code, 0, moved.stderr);
    assert.equal(only(sb).status, "in_progress");
    assert.match(moved.stdout, /^1 storage-layer \(in_progress\)/, "the label line is unchanged");

    const illegal = run(sb.store.root, ["state", "set", "1", "--status", "done"]);
    assert.equal(illegal.code, 2);
    assert.match(illegal.stderr, /in_progress -> done is not a legal transition/);
    assert.equal(only(sb).status, "in_progress");

    const forced = run(sb.store.root, ["state", "set", "1", "--status", "done", "--force"]);
    assert.equal(forced.code, 0, forced.stderr);
    assert.equal(only(sb).status, "done");

    const closed = run(sb.store.root, ["state", "set", "1", "--closed-by", "PR #4 merged as abc1234"]);
    assert.equal(closed.code, 0, closed.stderr);
    assert.equal(only(sb).closed_by, "PR #4 merged as abc1234");

    const bogus = run(sb.store.root, ["state", "set", "1", "--status", "nonsense"]);
    assert.equal(bogus.code, 2);
    assert.match(bogus.stderr, /'nonsense' is not a status/);
  } finally {
    sb.dispose();
  }
});
