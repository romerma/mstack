import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { mutationKey } from "../src/mutation.ts";
import { readLock } from "../src/mutation-lock.ts";
import { classify, runMutation } from "../src/mutation-run.ts";
import { restoreFromLock } from "../src/mutation-tree.ts";
import { parseState } from "../src/state.ts";
import { readRecords } from "../src/tsv.ts";
import { receipts, status as runStatus, treeId } from "../src/verification.ts";
import { recordReceipt } from "./helpers.ts";
import { git, gitDirOf, lockFileOf, put, runs, SPAWN_TEST, status, until, withRunRepo, type RunRepo } from "./mutation-fixture.ts";

/**
 * Item 42, task 3.1: `runMutation` in-process, on a sandbox whose project
 * verification is `tests/check.sh` (a test path, never reverted) checking the
 * content of `src/a.ts`: "new" at HEAD, "old" at the start.
 */

const CHECKOUT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));

/** The run's store is a sandbox, never this checkout or anything under it. */
function outsideCheckout(root: string): void {
  const real = realpathSync(root);
  assert.ok(real !== CHECKOUT && !real.startsWith(`${CHECKOUT}${sep}`), `the sandbox ${real} is inside the checkout`);
}

async function go(r: RunRepo, options: { timeoutMs?: number; step?: (name: string) => void } = {}): Promise<{ code: number; lines: string[]; text: string; last: string }> {
  outsideCheckout(r.root);
  const lines: string[] = [];
  const code = await runMutation(r.store, {
    timeoutMs: options.timeoutMs ?? 60_000,
    out: (line) => lines.push(line),
    ...(options.step === undefined ? {} : { step: options.step }),
  });
  return { code, lines, text: lines.join("\n"), last: lines[lines.length - 1] ?? "" };
}

const CHECK = 'echo run >> "$1"\ngrep -q new src/a.ts\n';
const startA = (root: string): void => put(root, "src/a.ts", "old\n");
const editA = (root: string): void => put(root, "src/a.ts", "new\n");
const read = (r: RunRepo, rel: string): string => readFileSync(join(r.root, rel), "utf8");

/** `git status`, the store's own lines left out: the run appends to verification.tsv. */
const tree = (r: RunRepo): string => status(r.root).split("\n").filter((l) => !l.includes(".mstack/")).join("\n");
const rows = (r: RunRepo): Record<string, string>[] => readRecords(r.store.verification);
const outcomes = (r: RunRepo): string[] => rows(r).map((x) => x["outcome"] ?? "");
const runsDir = (r: RunRepo): string => join(gitDirOf(r), "mstack-mutation");
const head = (r: RunRepo): string => git(r.root, "rev-parse", "HEAD");

/** A green receipt at this commit and tree, as `gate --full` writes it. */
const green = (r: RunRepo): void => void recordReceipt(r.box, { target: "(project)", sha: head(r), command: r.command, outcome: "passed" });

/** Nothing of the run is left: no lock, no run directory. */
function nothingLeft(r: RunRepo): void {
  assert.equal(existsSync(lockFileOf(r)), false, "the lock is still there");
  const left = existsSync(runsDir(r)) ? readdirSync(runsDir(r)) : [];
  assert.deepEqual(left, [], `run directories are left: ${left.join(", ")}`);
}

/** Processes whose command line holds `marker`. */
const survivors = (marker: string): string[] =>
  spawnSync("pgrep", ["-f", marker], { encoding: "utf8" }).stdout.split("\n").filter((l) => l !== "" && Number(l) !== process.pid);
let serial = 0;
const sleeper = (): string => `sleep 37.${process.pid % 1000}${serial++}`;

// bun ignores the `skip` option of node:test, so the function is chosen; a read-only directory stops nobody running as root.
const userTest = process.getuid?.() === 0 ? test.skip : test;

test("R6 a recorded green counts as the baseline", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    green(r);
    const before = tree(r);
    const { code, text } = await go(r);
    assert.equal(code, 0, text);
    assert.match(text, /recorded green at this tree, not re-run/);
    assert.equal(runs(r), 1, "the check ran again for the baseline");
    assert.equal(tree(r), before);
    nothingLeft(r);
  });
});

test("R6 a stale green does not count", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    recordReceipt(r.box, { target: "(project)", sha: r.start, command: r.command, outcome: "passed" });
    const { code, text } = await go(r);
    assert.equal(code, 0, text);
    assert.doesNotMatch(text, /recorded green/);
    assert.equal(runs(r), 2, "the baseline did not run, or the reverted run did not");
    nothingLeft(r);
  });
});

test("R2 the tree moved during the baseline", SPAWN_TEST, async () => {
  const script = 'echo run >> "$1"\nif [ ! -e "$1.moved" ]; then : > "$1.moved"; git commit -q --allow-empty -m moved; fi\ngrep -q new src/a.ts\n';
  await withRunRepo(script, startA, editA, async (r) => {
    const before = head(r);
    const { code, text } = await go(r);
    assert.equal(code, 2, text);
    assert.notEqual(head(r), before, "the script made no commit");
    assert.match(text, /HEAD moved/);
    assert.ok(text.includes(before.slice(0, 8)), text);
    assert.deepEqual(outcomes(r), [], "a receipt or a row was written");
    assert.equal(runs(r), 1);
    nothingLeft(r);
  });
});

test("R2 an untracked test file edited during the baseline", SPAWN_TEST, async () => {
  const script = 'echo run >> "$1"\nif [ ! -e "$1.edited" ]; then : > "$1.edited"; echo more >> tests/new.test.ts; fi\ngrep -q new src/a.ts\n';
  await withRunRepo(script, startA, editA, async (r) => {
    put(r.root, "tests/new.test.ts", "t\n");
    const { code, text } = await go(r);
    assert.equal(code, 2, text);
    assert.match(text, /tests\/new\.test\.ts/);
    assert.deepEqual(outcomes(r), [], "a receipt or a row was written");
    nothingLeft(r);
  });
});

test("R7 a red baseline is blocked and reverts nothing", SPAWN_TEST, async () => {
  await withRunRepo('echo run >> "$1"\nexit 1\n', startA, editA, async (r) => {
    const before = tree(r);
    const { code, text } = await go(r);
    assert.equal(code, 2, text);
    assert.match(text, /baseline is red/);
    assert.deepEqual(outcomes(r), ["failed", "mutation-blocked"]);
    assert.equal(runs(r), 1);
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal(tree(r), before);
    nothingLeft(r);
  });
});

test("R7 a baseline timeout records no failed receipt", SPAWN_TEST, async () => {
  const marker = sleeper();
  await withRunRepo(`echo run >> "$1"\n${marker}\n`, startA, editA, async (r) => {
    try {
      const { code, text } = await go(r, { timeoutMs: 2000 });
      assert.equal(code, 2, text);
      assert.match(text, /baseline timed out after 2s/);
      assert.deepEqual(outcomes(r), ["mutation-blocked"]);
      assert.ok(await until(() => survivors(marker).length === 0, 2000), "the baseline's group is still there");
      nothingLeft(r);
    } finally {
      for (const pid of survivors(marker)) process.kill(Number(pid), "SIGKILL");
    }
  });
});

test("R12 killed", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const before = tree(r);
    const { code, text, last } = await go(r);
    assert.equal(code, 0, text);
    assert.match(last, /^mutation-killed: /);
    assert.ok(last.includes(r.command), last);
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal(tree(r), before);
    nothingLeft(r);
  });
});

test("R12 a build failure is killed and says so", SPAWN_TEST, async () => {
  await withRunRepo('echo run >> "$1"\ngrep -q new src/a.ts || exit 2\n', startA, editA, async (r) => {
    const { code, text, last } = await go(r);
    assert.equal(code, 0, text);
    assert.match(last, /^mutation-killed: /);
    assert.match(text, /a build failure and an assertion failure look the same here/);
  });
});

test("R12 an exit of 128+n is killed and names the signal", SPAWN_TEST, async () => {
  await withRunRepo('echo run >> "$1"\ngrep -q new src/a.ts || exit 139\n', startA, editA, async (r) => {
    const { code, text, last } = await go(r);
    assert.equal(code, 0, text);
    assert.match(last, /^mutation-killed: /);
    assert.match(text, /signal 11\b/);
  });
});

test("R12 survived lists the paths", SPAWN_TEST, async () => {
  await withRunRepo('echo run >> "$1"\nexit 0\n', startA, editA, async (r) => {
    const { code, text, last } = await go(r);
    assert.equal(code, 1, text);
    assert.match(last, /^mutation-survived: /);
    assert.match(last, /src\/a\.ts/);
    assert.equal(read(r, "src/a.ts"), "new\n");
    nothingLeft(r);
  });
});

test("R12 a script removed by the revert is blocked", SPAWN_TEST, async () => {
  const addScript = (root: string): void => {
    editA(root);
    put(root, "scripts/check.sh", "exit 0\n");
  };
  await withRunRepo(CHECK, startA, addScript, async (r) => {
    r.box.writeState({ ...(parseState(r.store.state) as object), verify: "sh scripts/check.sh" });
    const { code, text, last } = await go(r);
    assert.equal(code, 2, text);
    assert.match(last, /^mutation-blocked: /);
    assert.match(text, /127/);
    assert.equal(read(r, "scripts/check.sh"), "exit 0\n");
    nothingLeft(r);
  });
});

test("R12 a hang is blocked at the timeout", SPAWN_TEST, async () => {
  const marker = sleeper();
  await withRunRepo(`echo run >> "$1"\ngrep -q new src/a.ts || ${marker}\n`, startA, editA, async (r) => {
    try {
      const { code, text, last } = await go(r, { timeoutMs: 2000 });
      assert.equal(code, 2, text);
      assert.match(last, /^mutation-blocked: /);
      assert.match(text, /timed out after 2s/);
      assert.ok(await until(() => survivors(marker).length === 0, 2000), "the command's group is still there");
      assert.equal(read(r, "src/a.ts"), "new\n");
      nothingLeft(r);
    } finally {
      for (const pid of survivors(marker)) process.kill(Number(pid), "SIGKILL");
    }
  });
});

userTest("R11 a revert that cannot complete runs no obligation and is blocked", SPAWN_TEST, async () => {
  const atStart = (root: string): void => {
    startA(root);
    put(root, "src/deep/old.ts", "old\n");
    put(root, "src/deep/keep.ts", "keep\n");
  };
  const change = (root: string): void => {
    editA(root);
    execFileSync("git", ["rm", "-q", "src/deep/old.ts"], { cwd: root });
  };
  await withRunRepo(CHECK, atStart, change, async (r) => {
    green(r);
    const before = tree(r);
    chmodSync(join(r.root, "src/deep"), 0o555);
    try {
      const { code, text, last } = await go(r);
      assert.equal(code, 2, text);
      assert.match(last, /^mutation-blocked: /);
      assert.match(text, /src\/deep\/old\.ts/);
      assert.match(text, /EACCES/);
      assert.equal(runs(r), 0, "a command ran on a tree the revert did not complete");
      assert.equal(read(r, "src/a.ts"), "new\n");
      assert.deepEqual(outcomes(r).slice(1), ["mutation-blocked"]);
    } finally {
      chmodSync(join(r.root, "src/deep"), 0o755);
    }
    assert.equal(tree(r), before);
    nothingLeft(r);
  });
});

test("R11 the run's restore after a stopped revert leaves the change that stopped it in place", SPAWN_TEST, async () => {
  const both = (root: string): void => {
    startA(root);
    put(root, "src/b.ts", "b\n");
  };
  const editBoth = (root: string): void => {
    editA(root);
    put(root, "src/b.ts", "b2\n");
  };
  await withRunRepo(CHECK, both, editBoth, async (r) => {
    green(r);
    const { code, text } = await go(r, {
      step: (name) => {
        if (name === "reverted:0") writeFileSync(join(r.root, "src/b.ts"), "the user's edit\n");
      },
    });
    assert.equal(code, 2, text);
    assert.match(text, /src\/b\.ts/);
    assert.equal(read(r, "src/b.ts"), "the user's edit\n");
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal(runs(r), 0);
    nothingLeft(r);
  });
});

test("R20 a mutation row has six cells and a mutation: tree", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const sha = head(r);
    const { code, text } = await go(r);
    assert.equal(code, 0, text);
    const last = readFileSync(r.store.verification, "utf8").trimEnd().split("\n").pop() ?? "";
    const cells = last.split("\t");
    assert.equal(cells.length, 6, last);
    assert.deepEqual(cells.slice(0, 4), ["storage-layer", sha, r.command, "mutation-killed"]);
    assert.match(cells[5] ?? "", /^mutation:[0-9a-f]{16}$/);
  });
});

test("R20 receipts() and status() ignore mutation rows", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const { code, text } = await go(r);
    assert.equal(code, 0, text);
    assert.equal(outcomes(r).pop(), "mutation-killed");
    const state = parseState(r.store.state);
    const item = state.items[0];
    const answer = (): unknown => ({ receipts: receipts(r.store), status: runStatus(r.store, state, item, head(r), treeId(r.store)) });
    const withRow = answer();
    const file = readFileSync(r.store.verification, "utf8");
    writeFileSync(r.store.verification, `${file.trimEnd().split("\n").slice(0, -1).join("\n")}\n`);
    assert.deepEqual(withRow, answer());
  });
});

userTest("R20 no row after a failed restore", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const before = tree(r);
    try {
      const { code, text } = await go(r, {
        step: (name) => {
          if (name === "obligations-running") chmodSync(join(r.root, "src"), 0o555);
        },
      });
      assert.equal(code, 3, text);
      assert.deepEqual(outcomes(r).filter((o) => o.startsWith("mutation-")), []);
      assert.equal(existsSync(lockFileOf(r)), true, "the lock went although the restore failed");
    } finally {
      chmodSync(join(r.root, "src"), 0o755);
    }
    const held = readLock(r.store);
    assert.ok(held !== null && "lock" in held);
    assert.deepEqual(restoreFromLock(r.store, held.lock).failed, []);
    assert.equal(tree(r), before);
  });
});

test("R21 the run does not move its own key", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const { code, text } = await go(r);
    assert.equal(code, 0, text);
    const row = rows(r).pop();
    const key = mutationKey(r.store, r.start);
    assert.ok(key.key !== null);
    assert.equal(row?.["tree"], `mutation:${key.key}`);
  });
});

test("R2 HEAD that moves before the staging reads it is refused, and nothing is written", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    green(r);
    const before = head(r);
    // A git on PATH that, the first time it is asked `rev-parse --verify HEAD` (prepareRun's own read), commits first.
    const real = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    const bin = join(r.scratch, "bin");
    mkdirSync(bin);
    const flag = join(r.scratch, "moved");
    writeFileSync(
      join(bin, "git"),
      `#!/bin/sh\nif [ "$1 $2 $3 $#" = "rev-parse --verify HEAD 3" ] && [ ! -e '${flag}' ]; then : > '${flag}'; '${real}' commit -q --allow-empty -m moved; fi\nexec '${real}' "$@"\n`,
    );
    chmodSync(join(bin, "git"), 0o755);
    const saved = process.env["PATH"];
    process.env["PATH"] = `${bin}:${saved ?? ""}`;
    let result;
    try {
      result = await go(r);
    } finally {
      process.env["PATH"] = saved;
    }
    assert.ok(existsSync(flag), "the staging did not read HEAD through git");
    assert.equal(result.code, 2, result.text);
    assert.match(result.text, /HEAD moved/);
    assert.ok(result.text.includes(before.slice(0, 8)), result.text);
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal(runs(r), 0);
    assert.deepEqual(outcomes(r).slice(1), []);
    nothingLeft(r);
  });
});

test("R1 a lock taken by another run after the staging is refused naming its pid, and the staging is removed", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    green(r);
    const other = { v: 1, run: "20260101T000000Z-1-abcd", pid: process.pid, startedAt: new Date().toISOString() };
    const { code, text } = await go(r, {
      step: (name) => {
        if (name === "prepared") writeFileSync(lockFileOf(r), JSON.stringify(other));
      },
    });
    assert.equal(code, 2, text);
    assert.ok(text.includes(`pid ${process.pid}`), text);
    assert.equal(JSON.parse(readFileSync(lockFileOf(r), "utf8")).run, other.run, "the other run's lock was touched");
    assert.equal(existsSync(runsDir(r)), false, "the refused run left its staging");
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal(runs(r), 0);
  });
});

test("R12 classify: 0 passes; 126, 127, a timeout, an error and a signal are blocked; any other code is a kill", () => {
  const base = { code: 0, signal: null, timedOut: false, tail: "" };
  assert.equal(classify(base), "passed");
  assert.equal(classify({ ...base, code: 1 }), "failed");
  assert.equal(classify({ ...base, code: 139 }), "failed");
  assert.equal(classify({ ...base, code: 126 }), "blocked");
  assert.equal(classify({ ...base, code: 127 }), "blocked");
  assert.equal(classify({ ...base, code: null, timedOut: true, signal: "SIGKILL" }), "blocked");
  assert.equal(classify({ ...base, code: null, error: "spawn ENOENT" }), "blocked");
  assert.equal(classify({ ...base, code: null, signal: "SIGSEGV" }), "blocked");
});

test("R13 an error right after the lock is taken ends in the restore, and the lock goes", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    green(r);
    const before = tree(r);
    const { code, text, last } = await go(r, {
      step: (name) => {
        if (name === "lock-written") throw new Error("a fault after the lock");
      },
    });
    assert.equal(code, 2, text);
    assert.match(last, /^mutation-blocked: .*a fault after the lock/);
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal(runs(r), 0);
    assert.equal(tree(r), before);
    nothingLeft(r);
  });
});
