import { statSync } from "node:fs";
import { basename, join } from "node:path";

import { activeItem } from "./state.ts";
import { REPORT_KINDS, reportFiles } from "./roles.ts";
import { Report } from "./report.ts";
import { UserError, type Store } from "./paths.ts";

/**
 * Fan-out, made real.
 *
 * `design` and `review` both say "launch in parallel" and `orchestrate` names
 * the twenty-subagent cap, and until now none of that was enforced by anything.
 * Prose cannot enforce a cap, and it cannot notice a worker that never came
 * back — skill content enters context once and is never re-read.
 *
 * The first end-to-end run showed what that costs. The review panel launched
 * three lenses, every one of them was told to write the same filename, and two
 * of the three would have been overwritten with no trace. The workers noticed
 * and invented their own suffixes, which the hook then read as a missing report.
 *
 * So the discriminator is allocated here, once, before anybody launches.
 */

/**
 * Claude Code runs at most twenty concurrent subagents per session. Fanning out
 * past that does not fail loudly; the excess queues, and a coordinator that
 * counts replies rather than workers reads the queue delay as a dropout.
 */
export const CONCURRENCY_CAP = 20;

/** A worker name has to survive being part of a filename, and stay readable. */
const WORKER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface FanoutPlan {
  kind: string;
  slug: string;
  workers: { name: string; report: string }[];
}

export function plan(
  store: Store,
  options: { kind: string; workers: readonly string[]; round?: number },
): FanoutPlan {
  const kind = options.kind;
  if (!Object.values(REPORT_KINDS).includes(kind)) {
    throw new UserError(
      `'${kind}' is not a report kind`,
      `one of: ${[...new Set(Object.values(REPORT_KINDS))].sort().join(", ")}`,
    );
  }

  const item = activeItem(store);
  if (item === undefined) throw new UserError("no active item to fan out on");

  if (options.workers.length === 0) throw new UserError("fan-out needs at least one --worker");
  if (options.workers.length > CONCURRENCY_CAP) {
    throw new UserError(
      `${options.workers.length} workers exceeds the ${CONCURRENCY_CAP} concurrent subagents Claude Code will run`,
      "fan out to what the work needs; the excess queues silently and reads as a dropout",
    );
  }

  const round = options.round ?? 1;
  if (!Number.isInteger(round) || round < 1) throw new UserError("--round must be a positive integer");

  const seen = new Set<string>();
  const workers = options.workers.map((name) => {
    if (!WORKER.test(name)) {
      throw new UserError(`'${name}' is not a usable worker name`, "lowercase words joined by hyphens");
    }
    // The whole point of allocating up front: two workers with one filename is
    // silent data loss, and it is the failure the first real run hit.
    if (seen.has(name)) throw new UserError(`two workers both named '${name}'`);
    seen.add(name);
    const suffix = round > 1 ? `r${round}-${name}` : name;
    return { name, report: join(store.progress, `${kind}_${item.slug}_${suffix}.md`) };
  });

  return { kind, slug: item.slug, workers };
}

/** A report under this floor is a stub. Same threshold the SubagentStop hook uses. */
const MIN_REPORT_BYTES = 40;

/**
 * Which workers came back.
 *
 * Named, never counted. "2 of 3 reports" tells a coordinator to go looking;
 * "security did not report" tells it what to re-run.
 */
export function check(store: Store, plan: FanoutPlan): Report {
  const report = new Report();
  report.section(`${plan.kind} fan-out on ${plan.slug}`);

  const missing: string[] = [];
  const empty: string[] = [];
  for (const worker of plan.workers) {
    let size: number;
    try {
      size = statSync(worker.report).size;
    } catch {
      missing.push(worker.name);
      continue;
    }
    if (size < MIN_REPORT_BYTES) empty.push(worker.name);
    else report.ok(`${worker.name} -> ${basename(worker.report)} (${size} bytes)`);
  }

  for (const name of missing) {
    report.fail(
      `${name} returned without writing its report`,
      "its reply is not evidence; re-run it and have it write the file before returning",
    );
  }
  for (const name of empty) {
    report.fail(`${name} wrote a stub, not a report`, "an empty file is indistinguishable from no work");
  }

  // A stray file matching the prefix means someone wrote outside the plan. That
  // is not a failure, but a coordinator that never sees it will not read it.
  const planned = new Set(plan.workers.map((w) => w.report));
  const strays = reportFiles(store.progress, plan.kind, plan.slug).filter((file) => !planned.has(file));
  for (const file of strays) report.warn(`${basename(file)} was not in the plan; nothing will read it`);

  return report;
}
