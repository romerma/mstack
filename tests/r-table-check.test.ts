import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closingProblems } from "../src/closing.ts";
import { parseState } from "../src/state.ts";
import { item, quiesce, sandbox, state, trackCurrent } from "./helpers.ts";

/**
 * Item 41: the gate and `state set --status done` read the requirement-to-test
 * table of the item's newest implementation report.
 *
 * Both seams are the real CLI, spawned under the runtime this suite runs on, on a
 * sandbox store in a throwaway git repository. Messages are asserted as literals.
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");
const EXE = process.execPath.endsWith("bun")
  ? { exe: "bun", flags: [] as string[] }
  : { exe: process.execPath, flags: ["--disable-warning=ExperimentalWarning", "--experimental-strip-types"] };
const T = { timeout: 120_000 };

type Box = ReturnType<typeof sandbox>;
type Result = { code: number; stdout: string; stderr: string };

function cli(box: Box, ...args: string[]): Result {
  const r = spawnSync(EXE.exe, [...EXE.flags, CLI, ...args], { cwd: box.store.root, encoding: "utf8", timeout: 30_000 });
  if (r.error !== undefined) throw r.error;
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
const HEAD = "| R | Test | Where |\n|---|---|---|\n";
const GOOD =
  "# Report\n\n## R to test\n" +
  HEAD +
  "| A1 | parses | `tests/a.test.ts:3` |\n| A2, A3 | both | tests/a.test.ts:10, tests/b.test.ts:2<br>`tests/b.test.ts:4-5` |\n";
const REPORT = ".mstack/progress/impl_tbl.md";

interface World {
  status?: string;
  base?: boolean;
  sdd?: boolean;
  reports?: Record<string, string>;
  spec?: string;
  files?: Record<string, string>;
  verification?: string;
}

function world(w: World = {}): Box {
  const box = sandbox();
  const put = (rel: string, text: string): void => {
    mkdirSync(dirname(join(box.store.root, rel)), { recursive: true });
    writeFileSync(join(box.store.root, rel), text, "utf8");
  };
  const files = { "tests/a.test.ts": lines(20), "tests/b.test.ts": lines(5), "src/x.ts": lines(30), "docs/n.md": lines(4), ...w.files };
  for (const [rel, text] of Object.entries(files)) put(rel, text);
  for (const [name, text] of Object.entries(w.reports ?? { "impl_tbl.md": GOOD })) put(`.mstack/progress/${name}`, text);
  if (w.sdd === true) {
    for (const f of ["proposal.md", "design.md", "tasks.md"]) put(`.mstack/specs/tbl/${f}`, `# ${f} of the item under test, long enough to count\n`);
    put(".mstack/specs/tbl/spec.md", w.spec ?? "## ADDED Requirements\n\n### Requirement: R1 first\nThe system MUST.\n\n### Requirement: R2 second\nThe system MUST.\n");
  }
  box.writeState(
    state([
      item({
        slug: "tbl",
        status: w.status ?? "reviewing",
        acceptance: ["first criterion", "second criterion", "third criterion"],
        ...(w.base === false ? {} : { base: box.sha }),
        ...(w.sdd === true ? { sdd: true } : {}),
        ...(w.verification === undefined ? {} : { verification: w.verification }),
      }),
    ]),
  );
  trackCurrent(box);
  quiesce(box);
  return box;
}

function inWorld(w: World, body: (box: Box) => void): void {
  const box = world(w);
  try {
    body(box);
  } finally {
    box.dispose();
  }
}

const GATE_FAIL = "cannot close as it stands, and ";
const ONE_STEP = "is one step from done, and ";

// ----------------------------------------------------------------- a good table

test("a good table passes the gate at reviewing and at verifying, and the item may close", T, () => {
  for (const status of ["reviewing", "verifying"]) {
    inWorld({ status }, (box) => {
      const gate = cli(box, "gate");
      assert.equal(gate.code, 0, `${status}: ${gate.stdout}${gate.stderr}`);
    });
  }
  inWorld({ status: "verifying" }, (box) => {
    const done = cli(box, "state", "set", "tbl", "--status", "done");
    assert.equal(done.code, 0, done.stderr);
  });
});

test("the spec path reads R-ids from spec.md, and a good table over them passes", T, () => {
  const report = HEAD + "| R1 | first | tests/a.test.ts:1 |\n| R2 | second | tests/b.test.ts:1 |\n";
  inWorld({ sdd: true, reports: { "impl_tbl.md": report } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
  });
});

// ----------------------------------------------------------------- problems

const problems: { name: string; report: string; message: string }[] = [
  {
    name: "no table with that header",
    report: "# Report\n\n| R | Test | Evidence |\n|---|---|---|\n| A1 | x | y |\n",
    message: `${REPORT} has no table headed | R | Test | Where |`,
  },
  {
    name: "an id with no row",
    report: HEAD + "| A1 | x | tests/a.test.ts:1 |\n| A3 | x | tests/a.test.ts:2 |\n",
    message: `${REPORT} has no row for A2 ("second criterion")`,
  },
  {
    name: "an id the item does not have",
    report: GOOD + "| A4 | x | tests/a.test.ts:1 |\n",
    message: `${REPORT} line 8 names A4, which this item does not have (it has A1, A2, A3)`,
  },
  {
    name: "a line past the end of the file",
    report: HEAD + "| A1, A2 | x | tests/a.test.ts:3 |\n| A3 | x | tests/b.test.ts:900 |\n",
    message: `${REPORT} line 4 (A3): tests/b.test.ts:900 is past the end of tests/b.test.ts, which has 5 lines`,
  },
  {
    name: "line zero",
    report: GOOD.replace("tests/a.test.ts:10", "tests/a.test.ts:0"),
    message: `${REPORT} line 7 (A2, A3): tests/a.test.ts:0 is not a line; lines start at 1`,
  },
  {
    name: "a range that ends past the file",
    report: GOOD.replace("tests/b.test.ts:4-5", "tests/b.test.ts:4-6"),
    message: `${REPORT} line 7 (A2, A3): tests/b.test.ts:4-6 is past the end of tests/b.test.ts, which has 5 lines`,
  },
  {
    name: "a range that runs backwards",
    report: GOOD.replace("tests/b.test.ts:4-5", "tests/b.test.ts:5-4"),
    message: `${REPORT} line 7 (A2, A3): tests/b.test.ts:5-4 runs backwards`,
  },
  {
    name: "a file that is not a test file",
    report: GOOD.replace("tests/a.test.ts:3", "src/x.ts:10"),
    message: `${REPORT} line 6 (A1): src/x.ts:10 is not a test file (the path classifier calls it code)`,
  },
  {
    name: "a doc is not a test file either",
    report: GOOD.replace("tests/a.test.ts:3", "docs/n.md:2"),
    message: `${REPORT} line 6 (A1): docs/n.md:2 is not a test file (the path classifier calls it doc)`,
  },
  {
    name: "a file that does not exist",
    report: GOOD.replace("tests/a.test.ts:3", "tests/gone.test.ts:3"),
    message: `${REPORT} line 6 (A1): tests/gone.test.ts:3 names a file that does not exist`,
  },
  {
    name: "a citation that is not path:line",
    report: GOOD.replace("`tests/a.test.ts:3`", "tests/a.test.ts"),
    message: `${REPORT} line 6 (A1): "tests/a.test.ts" is not path:line`,
  },
  {
    name: "a path that leaves the store's root",
    report: GOOD.replace("tests/a.test.ts:3", "../outside.test.ts:3"),
    message: `${REPORT} line 6 (A1): ../outside.test.ts:3 is outside the store's root`,
  },
  {
    name: "an n/a reason that is too short",
    report: GOOD.replace("`tests/a.test.ts:3`", "n/a: no test"),
    message: `${REPORT} line 6 (A1): the n/a: reason "no test" has 7 characters, and needs at least 12`,
  },
  {
    name: "an empty Where",
    report: GOOD.replace("`tests/a.test.ts:3`", " "),
    message: `${REPORT} line 6 (A1): the Where cell is empty`,
  },
  {
    name: "a row with the wrong number of cells",
    report: GOOD + "| A1 | only two |\n",
    message: `${REPORT} line 8: a row has 2 cells, the table has 3`,
  },
  {
    name: "a row whose first cell names no id",
    report: GOOD + "| | x | tests/a.test.ts:1 |\n",
    message: `${REPORT} line 8 names no requirement id in its first cell`,
  },
];

for (const p of problems) {
  test(`${p.name}: the gate at reviewing and at verifying, and state set done, say so`, T, () => {
    inWorld({ status: "reviewing", reports: { "impl_tbl.md": p.report } }, (box) => {
      const gate = cli(box, "gate");
      assert.equal(gate.code, 1, gate.stdout);
      assert.ok(gate.stdout.includes(GATE_FAIL + p.message), gate.stdout);
      assert.ok(gate.stdout.includes("| R | Test | Where |"), "the hint names the header: " + gate.stdout);
    });
    inWorld({ status: "verifying", reports: { "impl_tbl.md": p.report } }, (box) => {
      const gate = cli(box, "gate");
      assert.equal(gate.code, 1, gate.stdout);
      assert.ok(gate.stdout.includes(ONE_STEP + p.message), gate.stdout);
      const done = cli(box, "state", "set", "tbl", "--status", "done");
      assert.equal(done.code, 2, done.stdout);
      assert.ok(done.stderr.includes(`tbl cannot close: ${p.message}`), done.stderr);
    });
  });
}

test("a citation may carry a column, which is ignored: the line is what is checked", T, () => {
  inWorld({ reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/a.test.ts:3:5") } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout);
  });
  inWorld({ reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/a.test.ts:3-4:9") } }, (box) => {
    assert.equal(cli(box, "gate").code, 0);
  });
  inWorld({ reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/a.test.ts:21:5") } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes(`${REPORT} line 6 (A1): tests/a.test.ts:21:5 is past the end of tests/a.test.ts, which has 20 lines`), gate.stdout);
  });
});

test("a citation that names a directory says so, and one that names a file it cannot read says that", T, () => {
  inWorld({ files: { "tests/fixtures/x.json": "{}\n" }, reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/fixtures:3") } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes(`${REPORT} line 6 (A1): tests/fixtures:3 is a directory, not a test file`), gate.stdout);
    assert.ok(!gate.stdout.includes("does not exist"), gate.stdout);
  });
  if (process.getuid?.() === 0) return; // root reads mode 000
  inWorld({ files: { "tests/locked.test.ts": lines(5) }, reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/locked.test.ts:3") } }, (box) => {
    chmodSync(join(box.store.root, "tests/locked.test.ts"), 0);
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes(`${REPORT} line 6 (A1): tests/locked.test.ts:3 could not be read (EACCES)`), gate.stdout);
    assert.ok(!gate.stdout.includes("does not exist"), gate.stdout);
  });
});

test("a symlink inside tests/ that points out of the store's root is outside it", T, () => {
  const away = mkdtempSync(join(tmpdir(), "r-table-away-"));
  try {
    writeFileSync(join(away, "real.test.ts"), lines(10), "utf8");
    inWorld({ reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/link.test.ts:3") } }, (box) => {
      symlinkSync(join(away, "real.test.ts"), join(box.store.root, "tests/link.test.ts"));
      const gate = cli(box, "gate");
      assert.equal(gate.code, 1);
      assert.ok(gate.stdout.includes(`${REPORT} line 6 (A1): tests/link.test.ts:3 is outside the store's root`), gate.stdout);
    });
  } finally {
    rmSync(away, { recursive: true, force: true });
  }
});

test("the last line of a file with no trailing newline is a line", T, () => {
  const body = "one\ntwo\nthree"; // 3 lines, the last unterminated
  inWorld({ files: { "tests/nonl.test.ts": body }, reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/nonl.test.ts:3") } }, (box) => {
    assert.equal(cli(box, "gate").code, 0, "line 3 of 3 passes");
  });
  inWorld({ files: { "tests/nonl.test.ts": body }, reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "tests/nonl.test.ts:4") } }, (box) => {
    const gate = cli(box, "gate");
    assert.ok(gate.stdout.includes("tests/nonl.test.ts:4 is past the end of tests/nonl.test.ts, which has 3 lines"), gate.stdout);
  });
});

test("an n/a reason of 12 characters passes, and the count is of the trimmed reason", T, () => {
  inWorld({ reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "n/a: 123456789012") } }, (box) => {
    assert.equal(cli(box, "gate").code, 0);
  });
  inWorld({ reports: { "impl_tbl.md": GOOD.replace("`tests/a.test.ts:3`", "n/a:   12345678901  ") } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes('the n/a: reason "12345678901" has 11 characters, and needs at least 12'), gate.stdout);
  });
});

test("an item with no report at all fails and names the file it looked for", T, () => {
  inWorld({ reports: {} }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes(`${GATE_FAIL}it has no implementation report to read, ${REPORT} or a later round of it`), gate.stdout);
  });
});

test("every problem is reported, not only the first", T, () => {
  inWorld({ reports: { "impl_tbl.md": HEAD + "| A1 | x | src/x.ts:1 |\n" } }, (box) => {
    const out = cli(box, "gate").stdout;
    assert.ok(out.includes("src/x.ts:1 is not a test file"), out);
    assert.ok(out.includes('has no row for A2 ("second criterion")'), out);
    assert.ok(out.includes('has no row for A3 ("third criterion")'), out);
  });
});

test("a table in a fenced example does not count, so a report with only that fails", T, () => {
  inWorld({ reports: { "impl_tbl.md": "```\n" + GOOD + "```\n" } }, (box) => {
    assert.ok(cli(box, "gate").stdout.includes("has no table headed | R | Test | Where |"));
  });
});

// ----------------------------------------------------------------- rounds

test("the highest round wins: round 1 good, round 2 missing a row fails; round 2 good passes", T, () => {
  const round2 = REPORT.replace(".md", "_r2.md");
  inWorld({ reports: { "impl_tbl.md": GOOD, "impl_tbl_r2.md": HEAD + "| A1, A2 | x | tests/a.test.ts:1 |\n" } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes(`${round2} has no row for A3 ("third criterion")`), gate.stdout);
  });
  inWorld({ reports: { "impl_tbl.md": "bad, no table at all, round one\n", "impl_tbl_r2.md": GOOD, "impl_tbl_r10.md": GOOD } }, (box) => {
    assert.equal(cli(box, "gate").code, 0);
  });
  // 10 is later than 2: a name sort would read r2.
  inWorld({ reports: { "impl_tbl_r2.md": GOOD, "impl_tbl_r10.md": "no table here either\n" } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes(".mstack/progress/impl_tbl_r10.md has no table headed"), gate.stdout);
  });
});

// ----------------------------------------------------------------- who is checked

test("an item with no base is never checked, whatever its report says", T, () => {
  inWorld({ base: false, status: "verifying", reports: {} }, (box) => {
    assert.equal(cli(box, "gate").code, 0);
    assert.equal(cli(box, "state", "set", "tbl", "--status", "done").code, 0);
  });
});

test("an item still in progress is not reported by the gate", T, () => {
  inWorld({ status: "in_progress", reports: {} }, (box) => {
    assert.equal(cli(box, "gate").code, 0);
  });
});

test("a done item with a report that has no table is left alone: its note can be edited, unmarked", T, () => {
  // Pins what a person sees. The guard that makes closingProblems read nothing for a
  // closed item is killed by the function-level test at the end of this file.
  inWorld({ status: "done", reports: { "impl_tbl.md": "no table\n" } }, (box) => {
    const gate = cli(box, "gate");
    assert.ok(!gate.stdout.includes("R | Test | Where"), gate.stdout);
    const note = cli(box, "state", "set", "tbl", "--closed-by", "merged in PR 7");
    assert.equal(note.code, 0, note.stderr);
    assert.ok(!note.stdout.includes("forced"), note.stdout);
    assert.equal(parseState(box.store.state).items[0]?.closed_by, "merged in PR 7");
  });
});

const TABLE_FORCED = "closed without a good requirement-to-test table (forced): ";
const BOTH_FORCED = "closed unverified and without a good requirement-to-test table (forced): ";
const BAD_TABLE = HEAD + "| A1 | x | tests/a.test.ts:1 |\n";
const closedBy = (box: Box): string | undefined => parseState(box.store.state).items[0]?.closed_by;

test("--force past the table only: the refusal, the printed line and closed_by name the table, not a verification", T, () => {
  inWorld({ status: "verifying", reports: { "impl_tbl.md": BAD_TABLE } }, (box) => {
    const refused = cli(box, "state", "set", "tbl", "--status", "done", "--force");
    assert.equal(refused.code, 2);
    assert.ok(refused.stderr.includes("--force would close tbl past a failed closing check, and that has to be on the record"), refused.stderr);
    assert.ok(refused.stderr.includes(`it is stored in state.json as "${TABLE_FORCED}..."`), refused.stderr);
    assert.ok(!refused.stderr.includes("unverified"), refused.stderr);
    const forced = cli(box, "state", "set", "tbl", "--status", "done", "--force", "--closed-by", "A2 and A3 are proven elsewhere");
    assert.equal(forced.code, 0, forced.stderr);
    assert.ok(forced.stdout.includes(`forced: closed without a good requirement-to-test table - ${REPORT} has no row for A2`), forced.stdout);
    assert.ok(!forced.stdout.includes("did not run here"), forced.stdout);
    assert.equal(closedBy(box), `${TABLE_FORCED}A2 and A3 are proven elsewhere`);
    // a later note keeps the marker, and it is still the table's
    assert.equal(cli(box, "state", "set", "tbl", "--closed-by", "PR 5 merged").code, 0);
    assert.equal(closedBy(box), `${TABLE_FORCED}PR 5 merged`);
  });
});

test("--force past a verification only keeps its existing words, with a good table", T, () => {
  inWorld({ status: "verifying", verification: "pytest -q" }, (box) => {
    const forced = cli(box, "state", "set", "tbl", "--status", "done", "--force", "--closed-by", "no python on this host");
    assert.equal(forced.code, 0, forced.stderr);
    assert.ok(forced.stdout.includes("forced: closed on a verification that did not run here - "), forced.stdout);
    assert.ok(!forced.stdout.includes("requirement-to-test"), forced.stdout);
    assert.equal(closedBy(box), "closed unverified (forced): no python on this host");
  });
});

test("--force past both says both, verification first, and a later note keeps the marker", T, () => {
  inWorld({ status: "verifying", verification: "pytest -q", reports: { "impl_tbl.md": BAD_TABLE } }, (box) => {
    const refused = cli(box, "state", "set", "tbl", "--status", "done", "--force");
    assert.equal(refused.code, 2);
    assert.ok(refused.stderr.includes(`it is stored in state.json as "${BOTH_FORCED}..."`), refused.stderr);
    const forced = cli(box, "state", "set", "tbl", "--status", "done", "--force", "--closed-by", "checked by hand");
    assert.equal(forced.code, 0, forced.stderr);
    const out = forced.stdout.split("\n");
    const verif = out.findIndex((l) => l.startsWith("  forced: closed on a verification that did not run here - "));
    const table = out.findIndex((l) => l.startsWith("  forced: closed without a good requirement-to-test table - "));
    assert.ok(verif >= 0 && table > verif, forced.stdout);
    assert.ok(!out[verif]!.includes("has no row for"), "the verification line carries only verification problems: " + out[verif]);
    assert.ok(out[table]!.includes("has no row for A2"), out[table]);
    assert.equal(closedBy(box), `${BOTH_FORCED}checked by hand`);
    assert.equal(cli(box, "state", "set", "tbl", "--closed-by", "PR 5 merged").code, 0);
    assert.equal(closedBy(box), `${BOTH_FORCED}PR 5 merged`);
  });
});

test("an implementation report that cannot be read is a refusal --force does not override", T, () => {
  inWorld({ status: "verifying", reports: {} }, (box) => {
    mkdirSync(join(box.store.root, REPORT));
    const done = cli(box, "state", "set", "tbl", "--status", "done", "--force", "--closed-by", "trust me please");
    assert.equal(done.code, 2, done.stdout);
    assert.ok(done.stderr.includes(`${REPORT} could not be read`), done.stderr);
  });
});

// ----------------------------------------------------------------- the spec path

test("on the spec path an id with no row and an id the spec lacks are both reported", T, () => {
  inWorld({ sdd: true, reports: { "impl_tbl.md": HEAD + "| R1, R3 | x | tests/a.test.ts:1 |\n" } }, (box) => {
    const out = cli(box, "gate").stdout;
    assert.ok(out.includes(`${REPORT} has no row for R2`), out);
    assert.ok(out.includes(`${REPORT} line 3 names R3, which this item does not have (it has R1, R2)`), out);
  });
});

test("on the spec path the acceptance bullets are not ids: A1 is not an id of the item", T, () => {
  inWorld({ sdd: true, reports: { "impl_tbl.md": HEAD + "| A1 | x | tests/a.test.ts:1 |\n" } }, (box) => {
    assert.ok(cli(box, "gate").stdout.includes("names A1, which this item does not have (it has R1, R2)"));
  });
});

test("an sdd item whose spec has no readable requirement is a problem, not a crash", T, () => {
  inWorld({ sdd: true, spec: "## ADDED Requirements\n\nprose, no ids\n" }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes(".mstack/specs/tbl/spec.md has no requirement ids to map (### Requirement: R<n> <name>)"), gate.stdout);
  });
  inWorld({ sdd: true }, (box) => {
    // the spec file is gone: the gate's own spec check also fails, and ours says why it cannot map
    const spec = join(box.store.root, ".mstack/specs/tbl/spec.md");
    writeFileSync(spec, "", "utf8");
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes("has no requirement ids to map"), gate.stdout);
  });
});

// ----------------------------------------------------------------- the function the closing path calls

test("closingProblems reads nothing for a done or cancelled item, whatever its report says", T, () => {
  for (const status of ["done", "cancelled"]) {
    inWorld({ status, reports: { "impl_tbl.md": "no table\n" } }, (box) => {
      const st = parseState(box.store.state);
      assert.deepEqual(closingProblems(box.store, st, st.items[0]!).filter((p) => p.check === "r-to-test"), [], status);
    });
  }
  inWorld({ status: "verifying", reports: { "impl_tbl.md": "no table\n" } }, (box) => {
    const st = parseState(box.store.state);
    const found = closingProblems(box.store, st, st.items[0]!).filter((p) => p.check === "r-to-test");
    assert.equal(found.length, 1);
    assert.equal(found[0]!.overridable, true);
  });
});

test("a report file for a lens is not the implementation report", T, () => {
  inWorld({ reports: { "impl_tbl_extra.md": GOOD } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.ok(gate.stdout.includes("it has no implementation report to read"), gate.stdout);
  });
});
