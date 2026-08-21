import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { mkdirSync } from "node:fs";

import { parseState } from "../src/state.ts";
import { item, quiesce, sandbox, state, trackCurrent } from "./helpers.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

/**
 * `spawnSync`, not `execFileSync`, for one reason: it hands back stderr on a
 * *successful* exit too. The version this replaced returned `stderr: ""`
 * whenever the code was 0, which would have made "the Stop hook exits 0 and
 * writes the failures to stderr" untestable — and unfalsifiable, which is
 * worse.
 *
 * `input` overrides stdio[0], which is how the hook subcommands get their JSON:
 * they read stdin, and a hook fed nothing takes a different path.
 */
function run(
  cwd: string,
  args: readonly string[],
  options: { input?: string } = {},
): { stdout: string; stderr: string; code: number } {
  const result = spawnSync(BIN, [...args], {
    cwd,
    encoding: "utf8",
    ...(options.input !== undefined ? { input: options.input } : {}),
  });
  // `spawnSync` reports a failure to spawn at all — a moved or unexecutable
  // bin/mstack — on `error` rather than by throwing. Swallowed, that reads as
  // exit 1 with two empty streams, which is a plausible-looking test failure
  // pointing at the wrong thing. `execFileSync` threw here; keep that.
  if (result.error !== undefined) throw result.error;
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status ?? 1 };
}

/** Stage and commit everything, so the workspace section has nothing to warn about. */
function commitAll(cwd: string): void {
  for (const args of [["add", "-A"], ["commit", "-q", "-m", "fixture"]]) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
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

    // The one input that did *not* keep working the same way, pinned here
    // rather than left to a reader of the report. On main this exited 0 and
    // wrote `closed_by: ""`; the empty-value rule applies to every value flag,
    // and a flag exempted from it would be the surprise this item is about.
    const blank = run(sb.store.root, ["state", "set", "1", "--closed-by", ""]);
    assert.equal(blank.code, 2);
    assert.match(blank.stderr, /an empty --closed-by is not a value/);
    assert.match(blank.stderr, /--clear closed-by/);
    assert.equal(only(sb).closed_by, "PR #4 merged as abc1234", "the previous note survives a refusal");
  } finally {
    sb.dispose();
  }
});

/** The six `--clear` takes, exactly as `docs/wiki/The-CLI.md` promises them. */
const CLEARABLE: readonly (readonly [string, string, unknown])[] = [
  ["description", "description", "a description to remove"],
  ["source", "source", "issue #4"],
  ["verification", "verification", "npm test"],
  ["decision-required", "decision_required", "A question whose two answers produce different work?"],
  ["sdd", "sdd", true],
  ["closed-by", "closed_by", "a note for the next reader"],
];

test("every field the wiki says is clearable clears, and clearing it again says so", () => {
  const sb = sandbox();
  try {
    for (const [flag, key, value] of CLEARABLE) {
      sb.writeState(state([item(Object.fromEntries(CLEARABLE.map(([, k, v]) => [k, v])))]));
      assert.notEqual(only(sb)[key as keyof ReturnType<typeof only>], undefined, `${flag}: fixture must carry it`);

      const cleared = run(sb.store.root, ["state", "set", "1", "--clear", flag]);
      assert.equal(cleared.code, 0, `${flag}: ${cleared.stderr}`);
      assert.equal(
        only(sb)[key as keyof ReturnType<typeof only>],
        undefined,
        `--clear ${flag} must remove ${key}, not blank it`,
      );
      assert.match(cleared.stdout, new RegExp(`${key}: .* -> \\(unset\\)`), `${flag}: the removal must be reported`);
      // Every other field is untouched, so no --clear is quietly clearing two.
      for (const [, otherKey, otherValue] of CLEARABLE) {
        if (otherKey === key || otherKey === "decision_resolved") continue;
        assert.equal(only(sb)[otherKey as keyof ReturnType<typeof only>], otherValue, `${flag} also cleared ${otherKey}`);
      }

      const again = run(sb.store.root, ["state", "set", "1", "--clear", flag]);
      assert.equal(again.code, 0, `${flag}: clearing an absent field is a no-op, not an error`);
      assert.match(again.stdout, new RegExp(`${key}: already unset`), `${flag}: the no-op has to say so`);
    }
  } finally {
    sb.dispose();
  }
});

test("the change line never prints an identical before and after", () => {
  const sb = sandbox();
  try {
    // Two forks sharing a 45-character prefix. The preview truncates at 48, so
    // both render the same, and the same command drops decision_resolved: the
    // line that exists to make a write visible showed no change at all.
    const before = "Should the export be a stable public contract other tools may depend on?";
    const after = "Should the export be a stable public contract we are free to reshape at will?";
    sb.writeState(state([item({ status: "specifying", decision_required: before })]));

    const rewritten = run(sb.store.root, ["state", "set", "1", "--decision-required", after]);
    assert.equal(rewritten.code, 0, rewritten.stderr);
    assert.equal(only(sb).decision_required, after);

    const line = rewritten.stdout.split("\n").find((l) => l.includes("decision_required")) ?? "";
    assert.doesNotMatch(line, /"(.+)" -> "\1"/, `the arrow form printed the same value twice: ${line}`);
    assert.match(rewritten.stdout, /decision_required: changed, and the short forms match, so both in full/);
    // Literal, not a regex: the question marks in these forks are quantifiers
    // to a pattern, and a check that matches loosely is the thing this whole
    // finding is about.
    assert.ok(
      rewritten.stdout.includes(`was (72 chars) ${JSON.stringify(before)}`),
      `the old value in full: ${rewritten.stdout}`,
    );
    assert.ok(
      rewritten.stdout.includes(`now (77 chars) ${JSON.stringify(after)}`),
      `the new value in full: ${rewritten.stdout}`,
    );

    // ...and the ordinary case still abbreviates, which is what makes a
    // collision possible in the first place.
    const plain = run(sb.store.root, ["state", "set", "1", "--description", after]);
    assert.equal(plain.code, 0, plain.stderr);
    assert.match(plain.stdout, /description: \(unset\) -> "Should the export be a stable public contract\.\.\."/);
  } finally {
    sb.dispose();
  }
});

test("a value is stored trimmed, so a trailing space is not a different value", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const padded = run(sb.store.root, ["state", "set", "1", "--description", "  a padded description  "]);
    assert.equal(padded.code, 0, padded.stderr);
    assert.equal(only(sb).description, "a padded description", "surrounding whitespace is not part of a value");

    // The reason it matters: untrimmed, "$FORK " and "$FORK" were a rewrite,
    // which dropped the answer to a fork nobody had actually changed.
    const fork = "Is this a stable public contract, or a dump we can reshape?";
    sb.writeState(
      state([item({ status: "specifying", decision_required: fork, decision_resolved: "2026-01-01T00:00:00.000Z" })]),
    );
    const restated = run(sb.store.root, ["state", "set", "1", "--decision-required", `${fork} `]);
    assert.equal(restated.code, 0, restated.stderr);
    assert.equal(only(sb).decision_required, fork, "the stored fork is unchanged");
    assert.equal(only(sb).decision_resolved, "2026-01-01T00:00:00.000Z", "and its answer still stands");
    assert.doesNotMatch(restated.stdout, /decision_required/, "nothing changed, so nothing is reported");
  } finally {
    sb.dispose();
  }
});

test("--sdd past specifying announces what it does to the gate", () => {
  const sb = sandbox();
  try {
    // The gate is green before the command and red after it, at exit 0. The
    // fork path already announces exactly this; review found --sdd was the one
    // door that did it silently.
    sb.writeState(state([item({ status: "in_progress" })]));
    trackCurrent(sb);
    assert.equal(run(sb.store.root, ["gate", "--quiet"]).code, 0, "green before");

    const marked = run(sb.store.root, ["state", "set", "1", "--sdd"]);
    assert.equal(marked.code, 0, marked.stderr);
    assert.match(marked.stdout, /sdd: \(unset\) -> true/);
    assert.match(marked.stdout, /forced: storage-layer is in_progress with no spec at .*specs\/storage-layer/);
    assert.match(marked.stdout, /'mstack gate' fails until one is written or the item moves back to specifying/);

    const gate = run(sb.store.root, ["gate"]);
    assert.equal(gate.code, 1, "and the gate says the same thing the command just said");
    assert.match(gate.stdout, /sdd item storage-layer is in_progress but has no spec/);

    // With a spec on disk the command must not claim a failure that did not
    // happen; whether four present files are also complete is the gate's call.
    mkdirSync(join(sb.store.specs, "storage-layer"), { recursive: true });
    sb.writeState(state([item({ status: "in_progress" })]));
    const withSpec = run(sb.store.root, ["state", "set", "1", "--sdd"]);
    assert.equal(withSpec.code, 0, withSpec.stderr);
    assert.match(withSpec.stdout, /forced: storage-layer is in_progress, so 'mstack gate' now holds it to a complete spec/);
    assert.doesNotMatch(withSpec.stdout, /fails until one is written/, "no failure was created here");

    // Below the line there is nothing to announce.
    sb.writeState(state([item({ status: "pending" })]));
    const pending = run(sb.store.root, ["state", "set", "1", "--sdd"]);
    assert.equal(pending.code, 0, pending.stderr);
    assert.doesNotMatch(pending.stdout, /forced:/, "pending needs no spec, so there is no consequence to name");
  } finally {
    sb.dispose();
  }
});

/**
 * `--quiet` through the shipped binary, which is the only place the streams are
 * real. The unit tests in `gate.test.ts` patch `process.stderr.write`; these run
 * `bin/mstack` as a process and read fd 1 and fd 2 apart.
 */
test("gate --quiet prints its failures on stderr and leaves stdout empty", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    const red = run(sb.store.root, ["gate", "--quiet"]);
    assert.equal(red.code, 1);
    assert.equal(
      red.stderr,
      "[fail]  1 storage-layer (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start\n",
      "the wiki promises failures only; this is what that means byte for byte",
    );
    assert.equal(red.stdout, "", "stdout is where a hook's JSON goes");

    // The same store without the flag, to pin what quiet drops: the section
    // headers, the [ok] lines, the second `fix:` line and the count.
    const loud = run(sb.store.root, ["gate"]);
    assert.equal(loud.code, 1);
    assert.match(loud.stdout, /-- store/);
    assert.match(loud.stdout, /\[ok\]/);
    assert.match(loud.stdout, /^ +fix: if this session dies now/m);
    assert.match(loud.stdout, /FAILED - 1 failure/);
    for (const dropped of ["-- store", "[ok]", "FAILED - "]) {
      assert.ok(!red.stderr.includes(dropped), `quiet leaked ${JSON.stringify(dropped)}`);
    }

    // A green gate costs zero lines, which is what makes it cheap on a hook.
    trackCurrent(sb);
    const green = run(sb.store.root, ["gate", "--quiet"]);
    assert.equal(green.code, 0);
    assert.equal(green.stdout + green.stderr, "", `a passing quiet gate printed ${JSON.stringify(green.stdout + green.stderr)}`);
  } finally {
    sb.dispose();
  }
});

test("hook stop keeps its JSON on stdout and the gate's failures on stderr", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    const hook = run(sb.store.root, ["hook", "stop"], {
      input: JSON.stringify({ hook_event_name: "Stop", cwd: sb.store.root }),
    });

    assert.equal(hook.code, 0, "a Stop hook nudges; only exit 2 blocks");
    // The load-bearing assertion. Failure text on stdout would sit in front of
    // this object and Claude Code would have nothing structured to read.
    const parsed = JSON.parse(hook.stdout) as { hookSpecificOutput: { additionalContext: string } };
    assert.equal(hook.stdout.trimEnd(), JSON.stringify(parsed), "stdout is one JSON object and nothing else");
    assert.match(parsed.hookSpecificOutput.additionalContext, /The mstack gate is red/);
    assert.equal(
      hook.stderr,
      "[fail]  1 storage-layer (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start\n",
      "the failure reaches fd 2 of the hook process; what the client renders is the client's business",
    );

    trackCurrent(sb);
    const green = run(sb.store.root, ["hook", "stop"], {
      input: JSON.stringify({ hook_event_name: "Stop", cwd: sb.store.root }),
    });
    assert.equal(green.stdout + green.stderr, "", "a green Stop says nothing on either stream");
  } finally {
    sb.dispose();
  }
});

/**
 * Characterization, not endorsement: this pins what `--full` does **today** so
 * the scoping in `docs/wiki/The-CLI.md` is executable rather than prose.
 *
 * `--quiet` governs the gate's own lines. The verify command runs with its
 * stdio inherited, so its output reaches stdout whatever the flag says, and the
 * page's "nothing else on stdout" promise is therefore about the fast gate
 * only. Anything that wires `--full` to a hook — where stdout is the structured
 * channel — has to change this deliberately, and this test is what makes that
 * a decision instead of an accident.
 */
test("--full lets the verify command's output onto stdout, quiet or not", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([item({ status: "in_progress" })], { verify: "printf 'VERIFY-STDOUT-CANARY\\n'" }),
    );
    const full = run(sb.store.root, ["gate", "--full", "--quiet"]);

    assert.match(full.stdout, /VERIFY-STDOUT-CANARY/, "the subprocess writes to stdout through --quiet");
    // The gate's own quiet output is still on stderr and still failures-only,
    // so the exception is the subprocess and nothing wider.
    assert.match(full.stderr, /^\[fail\] {2}1 storage-layer \(in_progress\) is active but progress\/current\.md is not:/);
    assert.ok(!full.stderr.includes("VERIFY-STDOUT-CANARY"), "the canary belongs to stdout, not stderr");
    assert.ok(!full.stdout.includes("[fail]"), "the gate's own lines never move to stdout");
    assert.equal(full.code, 1);

    // Without --full the same store's stdout is empty, which is the contrast
    // the docs now draw.
    const fast = run(sb.store.root, ["gate", "--quiet"]);
    assert.equal(fast.stdout, "", "the fast gate keeps the promise --full cannot");
  } finally {
    sb.dispose();
  }
});

/**
 * Criterion 2 through the shipped binary, where the exit code is the half a
 * `Report` object cannot show. `--full` with nothing to run used to warn and
 * exit 0: the summary said PASSED and the shell agreed, so asking for the full
 * gate and getting no verification at all looked exactly like passing it.
 */
test("gate --full is distinguishable, in summary and exit code, from one that verified nothing", () => {
  const sb = sandbox();
  try {
    // Quiesced first so the only warning either run can carry is the edit to
    // state.json itself, which both runs make. The two summaries then differ in
    // exactly the thing under test.
    sb.writeState(state([item({ status: "in_progress" })], { verify: "" }));
    trackCurrent(sb);
    quiesce(sb);

    sb.writeState(state([item({ status: "in_progress" })], { verify: "" }));
    const nothing = run(sb.store.root, ["gate", "--full"]);
    assert.equal(nothing.code, 1, `--full that ran nothing exited ${nothing.code}`);
    assert.match(nothing.stdout, /\[fail\] {2}--full ran no verification/);
    assert.match(nothing.stdout, /^FAILED - 1 failure, 0 warnings$/m);

    sb.writeState(state([item({ status: "in_progress" })], { verify: "true" }));
    commitAll(sb.store.root);
    const ran = run(sb.store.root, ["gate", "--full"]);
    assert.equal(ran.code, 0, ran.stdout);
    assert.match(ran.stdout, /^\[ok\] {4}true$/m);
    assert.match(ran.stdout, /^PASSED - 0 failures, 0 warnings$/m);
  } finally {
    sb.dispose();
  }
});

/**
 * The bypass this closes was reproduced against the shipped binary before the
 * guard existed: an item at `verifying` with a red gate went green the instant
 * its status became `done`, because `done` is not active and the gate stops
 * looking. A requirement you can step out of by relabelling the thing is the
 * escape-hatch shape this project refuses everywhere else.
 */
test("an item cannot be closed on a verification that never ran here", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const refused = run(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.match(refused.stderr, /cannot close on a verification that has not run/);
    assert.match(refused.stderr, /`pytest -q` has never been executed/);
    assert.match(refused.stderr, /run 'mstack gate --full' at this commit/);
    assert.equal(parseState(sb.store.state).items[0]?.status, "verifying", "a refused close wrote nothing");

    // ...and it closes once the run is real. `gate --full` is the only thing
    // that records one, which is why the refusal names it.
    assert.equal(run(sb.store.root, ["gate", "--full"]).code, 1, "pytest is not installed here; the run is red");
    sb.writeState(state([item({ status: "verifying", verification: "true" })]));
    assert.equal(run(sb.store.root, ["gate", "--full"]).code, 0);
    const closed = run(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(closed.code, 0, closed.stderr);
    assert.equal(parseState(sb.store.state).items[0]?.status, "done");
  } finally {
    sb.dispose();
  }
});

test("--force closes it anyway, and says on the record that it did", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const forced = run(sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force"]);
    assert.equal(forced.code, 0, forced.stderr);
    // Loud, the way --sdd is loud. A silent override is the same hole with
    // better manners.
    assert.match(forced.stdout, /forced: closed on a verification that did not run here/);
    assert.match(forced.stdout, /`pytest -q` has never been executed/);
    assert.equal(parseState(sb.store.state).items[0]?.status, "done");
  } finally {
    sb.dispose();
  }
});

test("closing an item nothing verifies is not blocked by this guard", () => {
  const sb = sandbox();
  try {
    // The seeded-empty case. require_verdict_to_close is what governs closing
    // with no proof, and its typed answer for "no check could be run" is the
    // verifier-blocked verdict; this guard is about a verification that exists
    // and never ran.
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    const closed = run(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(closed.code, 0, closed.stderr);
    assert.equal(parseState(sb.store.state).items[0]?.status, "done");
  } finally {
    sb.dispose();
  }
});

test("state add refuses the empty values state set refuses", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([]));
    for (const [flag, value] of [
      ["--description", ""],
      ["--source", ""],
      ["--verification", ""],
      ["--decision-required", ""],
      ["--acceptance", "   "],
      ["--title", " "],
    ] as const) {
      const args = ["state", "add", "--slug", "empty-fields", "--title", "Empty everywhere", "--acceptance", "one"];
      const refused = run(sb.store.root, flag === "--title" ? [...args.slice(0, 4), flag, value, ...args.slice(6)] : [...args, flag, value]);
      assert.equal(refused.code, 2, `state add ${flag} "" must be refused: ${refused.stdout}`);
      assert.match(refused.stderr, new RegExp(`an empty ${flag} is not a value`));
    }
    assert.equal(parseState(sb.store.state).items.length, 0, "no refused add wrote an item");

    // The shape that made this a finding: an empty fork reads as no fork at
    // all in src/gate.ts, so the gate called an item carrying one green.
    const good = run(sb.store.root, ["state", "add", "--slug", "real-item", "--title", "Real", "--acceptance", "one"]);
    assert.equal(good.code, 0, good.stderr);
  } finally {
    sb.dispose();
  }
});
