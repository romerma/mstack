import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STORE_GITIGNORE } from "../src/setup.ts";
import {
  CLEAN_TREE,
  obligations,
  PROJECT_TARGET,
  receipts,
  record,
  status,
  treeId,
  UNKNOWN_TREE,
} from "../src/verification.ts";
import { parseState } from "../src/state.ts";
import { storeAt } from "../src/paths.ts";
import { item, quiesce, recordReceipt, sandbox, state } from "./helpers.ts";

/** The parsed State the module's functions take, built from the helpers' shape. */
function parsed(sb: ReturnType<typeof sandbox>, value: unknown) {
  sb.writeState(value);
  return parseState(sb.store.state);
}

test("the obligation list is exactly what --full would run, project command first", () => {
  const sb = sandbox();
  try {
    const st = parsed(
      sb,
      state([item({ status: "verifying", verification: "pytest -q" })], { verify: "make check" }),
    );
    assert.deepEqual(obligations(st, st.items[0]), [
      { command: "make check", target: PROJECT_TARGET },
      { command: "pytest -q", target: "storage-layer" },
    ]);

    // A seeded-but-empty verify is not a command, which is the shape every
    // fresh `mstack setup` store starts in.
    const seeded = parsed(sb, state([item({ status: "verifying" })], { verify: "   " }));
    assert.deepEqual(obligations(seeded, seeded.items[0]), []);
  } finally {
    sb.dispose();
  }
});

test("a receipt round-trips through the store file", () => {
  const sb = sandbox();
  try {
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    const rows = receipts(sb.store);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.command, "pytest -q");
    assert.equal(rows[0]?.outcome, "passed");
    assert.equal(rows[0]?.sha, sb.sha);
    assert.ok((rows[0]?.ts ?? "").length > 0, "a receipt is dated, or 'when it last ran' means nothing");
  } finally {
    sb.dispose();
  }
});

test("a command with no run anywhere is reported as never executed", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, ["`pytest -q` has never been executed"]);
  } finally {
    sb.dispose();
  }
});

test("a passing run at this commit satisfies the command, and only at this commit", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    assert.equal(status(sb.store, st, st.items[0], sb.sha).satisfied, true);

    // The ledger's rule, applied to a run: a new head SHA voids the row. The
    // message has to say the rows exist, or the reader goes looking for them.
    const moved = sb.commit();
    const after = status(sb.store, st, st.items[0], moved);
    assert.equal(after.satisfied, false);
    assert.deepEqual(after.problems, [
      "`pytest -q` has not run at " +
        moved.slice(0, 8) +
        "; 1 earlier run(s) exist at other commits, and a new commit voids them",
    ]);
  } finally {
    sb.dispose();
  }
});

test("a run that failed here is a different fact from one that never ran", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "failed" });
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, [`\`pytest -q\` ran at ${sb.sha.slice(0, 8)} and failed`]);
  } finally {
    sb.dispose();
  }
});

test("the last run at a commit wins, in both directions", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    const row = (outcome: "passed" | "failed", ts: string) =>
      recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome, ts });

    // Red, then fixed in the working tree and re-run green: green.
    row("failed", "2026-01-01T00:00:00.000Z");
    row("passed", "2026-01-01T00:01:00.000Z");
    assert.equal(status(sb.store, st, st.items[0], sb.sha).satisfied, true);

    // ...and green, then re-run red, is red. "Best" would have said otherwise,
    // which is how a broken suite keeps a stale pass.
    row("failed", "2026-01-01T00:02:00.000Z");
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.match(result.problems[0] ?? "", /ran at .* and failed/);
  } finally {
    sb.dispose();
  }
});

test("editing the verification string voids the receipt that vouched for the old one", () => {
  const sb = sandbox();
  try {
    const before = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    assert.equal(status(sb.store, before, before.items[0], sb.sha).satisfied, true);

    // The incident this whole file exists for was a `verification` that did not
    // execute. Keying the receipt to (item, sha) alone would let the green run
    // of the old string vouch for whatever replaced it.
    const after = parsed(sb, state([item({ status: "verifying", verification: "pytest -q --strict" })]));
    const result = status(sb.store, after, after.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, ["`pytest -q --strict` has never been executed"]);
  } finally {
    sb.dispose();
  }
});

test("both commands have to be green, and the failing one is named", () => {
  const sb = sandbox();
  try {
    const st = parsed(
      sb,
      state([item({ status: "verifying", verification: "pytest -q" })], { verify: "make check" }),
    );
    recordReceipt(sb, { target: PROJECT_TARGET, sha: sb.sha, command: "make check", outcome: "passed" });
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, ["`pytest -q` has never been executed"], "one green does not carry the other");
  } finally {
    sb.dispose();
  }
});

/**
 * Round 2, finding 4. Where the command match lands, pinned rather than
 * emergent.
 *
 * The tolerant half came out of `.trim()` in `obligations` plus `cell`'s
 * collapse of `[\t\r\n]+`, and nothing asserted it: a mutation that stopped
 * normalising the stored text left the whole suite green while a trailing
 * newline in a `verification` field would have voided every receipt. This item's
 * own history is a `verification` typed by hand at intake, so a stray newline in
 * one is not exotic.
 *
 * The strict half is the more important direction and it fails closed: anything
 * this cannot prove is the same command, it demands a re-run of.
 */
test("surrounding whitespace is the same command; internal whitespace is not", () => {
  const sb = sandbox();
  try {
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });

    for (const [spelling, why] of [
      ["pytest -q", "the command itself"],
      ["  pytest -q", "leading spaces"],
      ["pytest -q  ", "trailing spaces"],
      ["pytest -q\n", "a trailing newline, which is what a hand-typed field carries"],
      ["\tpytest -q\t", "tabs on both ends"],
    ] as const) {
      const st = parsed(sb, state([item({ status: "verifying", verification: spelling })]));
      assert.equal(
        status(sb.store, st, st.items[0], sb.sha).satisfied,
        true,
        `${why}: ${JSON.stringify(spelling)} should be satisfied by the recorded run`,
      );
    }

    // Strict past the edges, and deliberately so. These may well be the same
    // command to a shell; this module is not a shell, and demanding a re-run is
    // the safe direction.
    for (const [spelling, why] of [
      ["pytest  -q", "doubled internal space"],
      ["/usr/bin/pytest -q", "semantically identical, textually not"],
      ["pytest -q --strict", "a real change"],
    ] as const) {
      const st = parsed(sb, state([item({ status: "verifying", verification: spelling })]));
      assert.equal(
        status(sb.store, st, st.items[0], sb.sha).satisfied,
        false,
        `${why}: ${JSON.stringify(spelling)} must not be satisfied by a run of "pytest -q"`,
      );
    }
  } finally {
    sb.dispose();
  }
});

test("identical project and item commands are one obligation, not two runs", () => {
  const sb = sandbox();
  try {
    // Two obligations resolving to one receipt meant running the suite twice
    // per `gate --full`, which this repository's own store pays for.
    const st = parsed(
      sb,
      state([item({ status: "verifying", verification: "npm test" })], { verify: "npm test" }),
    );
    assert.deepEqual(obligations(st, st.items[0]), [{ command: "npm test", target: PROJECT_TARGET }]);

    // ...and a command that only looks similar is still its own obligation.
    const apart = parsed(
      sb,
      state([item({ status: "verifying", verification: "npm test -- --bail" })], { verify: "npm test" }),
    );
    assert.equal(obligations(apart, apart.items[0]).length, 2);
  } finally {
    sb.dispose();
  }
});

test("the tree fingerprint ignores the store and nothing else", () => {
  const sb = sandbox();
  try {
    quiesce(sb);
    const clean = treeId(sb.store);
    assert.equal(clean, CLEAN_TREE, "a committed tree should read as clean, not as a hash");

    // Store churn: every session does this while an item is open.
    writeFileSync(sb.store.current, "# Current session\n\n- **Item:** 1 x\n\n## Next step\n\ngo\n", "utf8");
    sb.writeState(state([item({ status: "verifying" })]));
    assert.equal(treeId(sb.store), clean, "writing progress notes must not change the tree identity");

    // Code churn: it must.
    writeFileSync(join(sb.store.root, "app.js"), "1\n", "utf8");
    const dirty = treeId(sb.store);
    assert.notEqual(dirty, clean);
    assert.match(dirty, /^[0-9a-f]{16}$/, "a dirty tree is identified by a hash of what is dirty");

    // The same edit twice is the same tree; a different edit is not.
    writeFileSync(join(sb.store.root, "app.js"), "1\n", "utf8");
    assert.equal(treeId(sb.store), dirty, "an identical tree must produce an identical id");
    writeFileSync(join(sb.store.root, "other.js"), "2\n", "utf8");
    assert.notEqual(treeId(sb.store), dirty);
  } finally {
    sb.dispose();
  }
});

/**
 * `git hash-object --stdin-paths` is newline-separated and has no `-z` form, so
 * a filename containing a newline cannot be handed to it unambiguously.
 *
 * Hashing the rest and calling the result a tree fingerprint would be a partial
 * answer wearing a complete answer's name, which is the defect class this whole
 * module exists to close. It becomes an unknown tree instead, which the gate
 * then warns about out loud.
 */
/**
 * Two untracked files with identical contents and different names are two
 * different states, so the path has to be in the key beside the content hash.
 *
 * A mutation dropping the path from the pairing survived every other tree test,
 * because all of them happened to use files whose contents differed too.
 */
test("which untracked files exist is part of the tree, not just what is in them", () => {
  const sb = sandbox();
  try {
    quiesce(sb);
    writeFileSync(join(sb.store.root, "a.js"), "same bytes\n", "utf8");
    const withA = treeId(sb.store);

    rmSync(join(sb.store.root, "a.js"));
    writeFileSync(join(sb.store.root, "b.js"), "same bytes\n", "utf8");
    assert.notEqual(
      treeId(sb.store),
      withA,
      "identical content under a different name is a different working tree",
    );

    // The same rule for entries that are described rather than read. Two
    // symlinks to one target take the token path, not the blob path, and a
    // mutation dropping the path from *that* pairing survived until this pair
    // existed — the file case above went through the other branch entirely.
    rmSync(join(sb.store.root, "b.js"));
    symlinkSync("/some/shared/target", join(sb.store.root, "link-one"));
    const withOne = treeId(sb.store);
    rmSync(join(sb.store.root, "link-one"));
    symlinkSync("/some/shared/target", join(sb.store.root, "link-two"));
    assert.notEqual(treeId(sb.store), withOne, "one target, two link names, two different trees");
  } finally {
    sb.dispose();
  }
});

/**
 * A filename whose last character is whitespace still fingerprints.
 *
 * `-z` is what earns this: without it git *quotes* any path with a special
 * character, and a quoted path is not the path. (`raw` is not what earns it —
 * that was the first version of this comment, and measuring said otherwise: JS
 * `trim()` stops at the NUL, so the trailing space never reaches it.)
 */
test("an untracked filename ending in a space is still fingerprinted", () => {
  const sb = sandbox();
  try {
    quiesce(sb);
    writeFileSync(join(sb.store.root, "trailing space "), "one\n", "utf8");
    const before = treeId(sb.store);
    assert.match(before, /^[0-9a-f]{16}$/, `a trailing-space path must not disable the tree half: ${before}`);

    writeFileSync(join(sb.store.root, "trailing space "), "two\n", "utf8");
    assert.notEqual(treeId(sb.store), before, "and its contents still have to matter");
  } finally {
    sb.dispose();
  }
});

/**
 * Round 4. `git hash-object` follows symlinks and hashes the target's bytes;
 * git's own index does not — it records a symlink blob as the *target string*.
 *
 * Following the link was wrong four ways at once, and every one of them was an
 * ordinary untracked symlink: made, not yet committed, not yet ignored. Two of
 * the four could not be hashed at all, so the whole tree half switched itself
 * off and a real item closed green on a verification exiting 1.
 *
 * No test in the suite created a symlink before this one.
 */
const SYMLINK_ROWS = [
  ["a directory", (base: string) => base],
  ["a dangling target", () => "/nonexistent/nothing"],
  ["a file outside the repository", (base: string) => join(base, "outside.txt")],
  ["a character device", () => "/dev/zero"],
] as const;

test("an untracked symlink is fingerprinted, never followed and never opened", () => {
  const sb = sandbox();
  try {
    const outside = mkdtempSync(join(tmpdir(), "mstack-symlink-"));
    writeFileSync(join(outside, "outside.txt"), "bytes that are not part of this project\n", "utf8");
    try {
      quiesce(sb);
      for (const [label, target] of SYMLINK_ROWS) {
        const link = join(sb.store.root, "the-link");
        symlinkSync(target(outside), link);
        const started = Date.now();
        const id = treeId(sb.store);
        const elapsed = Date.now() - started;
        // A directory link and a dangling link used to yield `unknown`, which is
        // the tree half switching off; `/dev/zero` used to read until the
        // five-second git timeout and then yield `unknown` anyway.
        assert.match(id, /^[0-9a-f]{16}$/, `a symlink to ${label} must fingerprint, got ${id}`);
        // The `/dev/zero` row: reading through the link sat on the git timeout,
        // twice per gate. Generous, because this guards against a stall rather
        // than measuring one.
        assert.ok(elapsed < 2_000, `a symlink to ${label} must not be read through: took ${elapsed}ms`);
        rmSync(link);
        assert.equal(treeId(sb.store), CLEAN_TREE, `removing the link to ${label} must restore clean`);
      }
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  } finally {
    sb.dispose();
  }
});

test("a symlink's target contents are not in the key, but its target is", () => {
  const sb = sandbox();
  try {
    const outside = mkdtempSync(join(tmpdir(), "mstack-symlink-"));
    try {
      const first = join(outside, "one.txt");
      const second = join(outside, "two.txt");
      writeFileSync(first, "ORIGINAL\n", "utf8");
      writeFileSync(second, "OTHER\n", "utf8");
      quiesce(sb);
      symlinkSync(first, join(sb.store.root, "the-link"));
      const before = treeId(sb.store);

      // The bytes on the far side of the link are not part of this repository,
      // and reading them would put a file outside the project into a key that is
      // recomputed at the end of every turn.
      writeFileSync(first, "COMPLETELY DIFFERENT CONTENTS\n", "utf8");
      assert.equal(treeId(sb.store), before, "the target's contents must not move the fingerprint");

      // ...but the link itself is state, and git records exactly this.
      rmSync(join(sb.store.root, "the-link"));
      symlinkSync(second, join(sb.store.root, "the-link"));
      assert.notEqual(treeId(sb.store), before, "repointing the link must move it");
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  } finally {
    sb.dispose();
  }
});

/**
 * Found while fixing the symlinks, not reported by review.
 *
 * `git ls-files` prints paths relative to the *current directory*;
 * `hash-object --stdin-paths` resolves them relative to the *repository root*.
 * For a store in a subdirectory those disagree, `hash-object` fails outright,
 * and every run in that store fingerprinted as `unknown` — the same silent
 * switch-off, reachable by nothing more exotic than where the store sits.
 */
test("a store in a subdirectory fingerprints its repository, rather than giving up", () => {
  const outer = mkdtempSync(join(tmpdir(), "mstack-nested-"));
  try {
    const run = (args: string[], cwd: string) => execFileSync("git", args, { cwd, stdio: "ignore" });
    run(["init", "-q", "."], outer);
    run(["config", "user.email", "t@e.com"], outer);
    run(["config", "user.name", "t"], outer);
    writeFileSync(join(outer, "root.txt"), "a\n", "utf8");
    run(["add", "-A"], outer);
    run(["commit", "-q", "-m", "i"], outer);

    const sub = join(outer, "sub");
    mkdirSync(join(sub, ".mstack"), { recursive: true });
    const store = storeAt(sub);
    assert.equal(treeId(store), CLEAN_TREE, "a committed nested store starts clean");

    // Untracked on both sides of the store's own directory: one above it, one
    // beside it. Both are the project, and both have to be in the key.
    writeFileSync(join(outer, "above.js"), "1\n", "utf8");
    const withAbove = treeId(store);
    assert.match(withAbove, /^[0-9a-f]{16}$/, `a nested store must not answer unknown, got ${withAbove}`);

    writeFileSync(join(sub, "beside.js"), "2\n", "utf8");
    const withBoth = treeId(store);
    assert.notEqual(withBoth, withAbove, "a file beside the store counts too");

    // The assertions above both hold even when every path resolves to nowhere,
    // because a path that cannot be stat-ed still contributes a token and still
    // moves the hash. Only content proves the paths were actually resolved —
    // a mutation dropping `--full-name` survived until this pair existed.
    writeFileSync(join(outer, "above.js"), "CHANGED\n", "utf8");
    assert.notEqual(treeId(store), withBoth, "contents above the store have to be read");
    const beforeBeside = treeId(store);
    writeFileSync(join(sub, "beside.js"), "CHANGED TOO\n", "utf8");
    assert.notEqual(treeId(store), beforeBeside, "contents beside the store have to be read");
  } finally {
    rmSync(outer, { recursive: true, force: true });
  }
});

/**
 * Git only ever offers regular files and symlinks, which is worth pinning
 * because I got it wrong.
 *
 * I justified classifying by file kind on the grounds that a fifo in the
 * worktree would stall `hash-object` with no symlink involved. It does not: git
 * lists neither a fifo, nor a socket, nor a device node as untracked, so the
 * only entry kinds that reach the fingerprint are the two below. The
 * `/dev/zero` stall only ever arrived *through* a link.
 */
test("git never offers a fifo as untracked, so only files and symlinks reach the fingerprint", () => {
  const sb = sandbox();
  try {
    quiesce(sb);
    // POSIX, and asserted rather than assumed: a silently skipped fixture here
    // would be a check that cannot fail, in the module about checks that cannot
    // fail.
    execFileSync("mkfifo", [join(sb.store.root, "a-pipe")]);
    assert.ok(lstatSync(join(sb.store.root, "a-pipe")).isFIFO(), "the fixture has to actually be a fifo");

    const listed = execFileSync("git", ["ls-files", "-o", "--exclude-standard"], {
      cwd: sb.store.root,
      encoding: "utf8",
    });
    assert.equal(listed, "", `git listed something other than files and symlinks: ${JSON.stringify(listed)}`);
    assert.equal(treeId(sb.store), CLEAN_TREE, "and so it is not in the tree either");
  } finally {
    sb.dispose();
  }
});

test("status judges against the tree it is handed, so the gate can compute it once", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    quiesce(sb);
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sb.store.root, encoding: "utf8" }).trim();
    record(sb.store, {
      target: "storage-layer",
      sha: head,
      command: "pytest -q",
      outcome: "passed",
      tree: "a-tree-that-is-not-this-one",
    });

    // Default: computed from the real working tree, which is clean, so the
    // receipt above does not match.
    assert.equal(status(sb.store, st, st.items[0], head).satisfied, false);
    // Handed one explicitly: that is what it judges against. Threading this is
    // what stops the fast gate computing the fingerprint twice per run.
    assert.equal(status(sb.store, st, st.items[0], head, "a-tree-that-is-not-this-one").satisfied, true);
  } finally {
    sb.dispose();
  }
});

test("a newline in an untracked path yields an unknown tree, not a partial one", () => {
  const sb = sandbox();
  try {
    quiesce(sb);
    assert.equal(treeId(sb.store), CLEAN_TREE);

    writeFileSync(join(sb.store.root, "ordinary.js"), "1\n", "utf8");
    assert.match(treeId(sb.store), /^[0-9a-f]{16}$/, "an ordinary untracked file still fingerprints");

    // The nasty spelling, and the reason it is this one: `two` and `lines.js`
    // also exist, so feeding `two\nlines.js` to `hash-object --stdin-paths`
    // *succeeds* — as two hashes for one listed path. Without the count check
    // those get paired up and a fingerprint comes out that quietly ignores a
    // file. Measured: with both guards `unknown`, with either one `unknown`,
    // with neither a real-looking hash. Each guard alone is an equivalent
    // mutant; the pair is not, which is what this fixture pins.
    writeFileSync(join(sb.store.root, "two"), "x\n", "utf8");
    writeFileSync(join(sb.store.root, "lines.js"), "y\n", "utf8");
    writeFileSync(join(sb.store.root, "two\nlines.js"), "z\n", "utf8");
    assert.equal(
      treeId(sb.store),
      UNKNOWN_TREE,
      "a path this cannot feed through hash-object must not be silently skipped",
    );
  } finally {
    sb.dispose();
  }
});

test("nothing configured is vacuously satisfied, and says the list was empty", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying" })]));
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.deepEqual(result.required, []);
    assert.equal(result.satisfied, true);
    assert.deepEqual(result.problems, []);
  } finally {
    sb.dispose();
  }
});

test("setup writes a store .gitignore, because a committed receipt voids itself", () => {
  const sb = sandbox();
  try {
    const body = readFileSync(join(sb.store.dir, ".gitignore"), "utf8");
    assert.equal(body, STORE_GITIGNORE);
    assert.match(body, /^verification\.tsv$/m);
    // Only that one file. Every other file in the store is durable state under
    // version control, and an over-broad rule here would silently stop
    // committing a ledger row or a decision.
    assert.deepEqual(
      body.split("\n").filter((line) => line !== "" && !line.startsWith("#")),
      ["verification.tsv"],
    );
  } finally {
    sb.dispose();
  }
});
