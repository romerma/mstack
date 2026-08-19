import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { CONCURRENCY_CAP, check, plan } from "../src/fanout.ts";
import { UserError } from "../src/paths.ts";
import { sandbox, state, item, expectFail, expectPass } from "./helpers.ts";

function active() {
  const box = sandbox();
  box.writeState(state([item({ status: "reviewing" })]));
  return box;
}

test("every worker gets its own path, which is the whole reason this exists", () => {
  const box = active();
  try {
    const p = plan(box.store, { kind: "review", workers: ["correctness", "security", "tests"] });
    const paths = p.workers.map((w) => w.report);

    assert.equal(new Set(paths).size, 3, "the first real run lost two of three reviews to one filename");
    assert.deepEqual(paths.map((path) => basename(path)), [
      "review_storage-layer_correctness.md",
      "review_storage-layer_security.md",
      "review_storage-layer_tests.md",
    ]);
  } finally {
    box.dispose();
  }
});

test("two workers with the same name are refused before anything launches", () => {
  const box = active();
  try {
    assert.throws(
      () => plan(box.store, { kind: "review", workers: ["security", "security"] }),
      (error: unknown) => error instanceof UserError && /both named 'security'/.test((error as Error).message),
    );
  } finally {
    box.dispose();
  }
});

test("the concurrency cap is enforced by code, not mentioned in prose", () => {
  const box = active();
  try {
    const many = Array.from({ length: CONCURRENCY_CAP + 1 }, (_, i) => `lens-${i}`);
    assert.throws(
      () => plan(box.store, { kind: "review", workers: many }),
      (error: unknown) => error instanceof UserError && /exceeds the 20 concurrent subagents/.test((error as Error).message),
      "over the cap the excess queues silently, and queue delay reads as a dropout",
    );

    const exactly = Array.from({ length: CONCURRENCY_CAP }, (_, i) => `lens-${i}`);
    assert.equal(plan(box.store, { kind: "review", workers: exactly }).workers.length, CONCURRENCY_CAP);
  } finally {
    box.dispose();
  }
});

test("a later round does not collide with the first", () => {
  const box = active();
  try {
    const first = plan(box.store, { kind: "review", workers: ["tests"] });
    const second = plan(box.store, { kind: "review", workers: ["tests"], round: 2 });

    assert.notEqual(first.workers[0]!.report, second.workers[0]!.report);
    assert.equal(basename(second.workers[0]!.report), "review_storage-layer_r2-tests.md");
  } finally {
    box.dispose();
  }
});

test("a worker that did not report is named, not counted", () => {
  const box = active();
  try {
    const p = plan(box.store, { kind: "review", workers: ["correctness", "security"] });
    writeFileSync(p.workers[0]!.report, "# Review\n\nAPPROVED. See src/storage.ts:12.\n", "utf8");

    // "1 of 2 reports" sends a coordinator looking. "security did not report"
    // tells it what to re-run.
    expectFail(check(box.store, p), /^security returned without writing its report/, "named dropout");
  } finally {
    box.dispose();
  }
});

test("a stub is a dropout, and a full sibling does not excuse it", () => {
  const box = active();
  try {
    const p = plan(box.store, { kind: "review", workers: ["correctness", "security"] });
    writeFileSync(p.workers[0]!.report, "# Review\n\nAPPROVED. See src/storage.ts:12.\n", "utf8");
    writeFileSync(p.workers[1]!.report, "# Review\n", "utf8");

    expectFail(check(box.store, p), /^security wrote a stub/, "stub");
  } finally {
    box.dispose();
  }
});

test("every worker back with a real report passes", () => {
  const box = active();
  try {
    const p = plan(box.store, { kind: "review", workers: ["correctness", "security"] });
    for (const worker of p.workers) {
      writeFileSync(worker.report, `# Review - ${worker.name}\n\nAPPROVED. See src/storage.ts:12.\n`, "utf8");
    }
    expectPass(check(box.store, p), "all reported");
  } finally {
    box.dispose();
  }
});

test("a report written outside the plan is surfaced, because nothing would read it", () => {
  const box = active();
  try {
    const p = plan(box.store, { kind: "review", workers: ["correctness"] });
    writeFileSync(p.workers[0]!.report, "# Review\n\nAPPROVED. See src/storage.ts:12.\n", "utf8");
    writeFileSync(
      join(box.store.progress, "review_storage-layer_freelance.md"),
      "# Review\n\nCHANGES_REQUESTED, and nobody will ever see this.\n",
      "utf8",
    );

    const report = check(box.store, p);
    assert.equal(report.failed, false, "an extra report is not a failure");
    assert.ok(
      report.warnings.some((w) => /review_storage-layer_freelance\.md was not in the plan/.test(w)),
      `expected a warning, got ${JSON.stringify(report.warnings)}`,
    );
  } finally {
    box.dispose();
  }
});

test("fanning out with no active item is refused rather than guessed at", () => {
  const box = sandbox();
  try {
    box.writeState(state([item({ status: "pending" })]));
    assert.throws(
      () => plan(box.store, { kind: "review", workers: ["correctness"] }),
      (error: unknown) => error instanceof UserError && /no active item/.test((error as Error).message),
    );
  } finally {
    box.dispose();
  }
});

test("an unknown kind is refused with the list of real ones", () => {
  const box = active();
  try {
    assert.throws(
      () => plan(box.store, { kind: "audit", workers: ["correctness"] }),
      (error: unknown) => error instanceof UserError && /'audit' is not a report kind/.test((error as Error).message),
    );
  } finally {
    box.dispose();
  }
});

test("a worker name that would not survive a filename is refused", () => {
  const box = active();
  try {
    for (const name of ["../escape", "has space", "UPPER", "trailing-", ""]) {
      assert.throws(
        () => plan(box.store, { kind: "review", workers: [name] }),
        (error: unknown) => error instanceof UserError,
        `'${name}' should not be accepted as a worker name`,
      );
    }
  } finally {
    box.dispose();
  }
});
