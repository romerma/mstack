import { statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import * as decisions from "./decisions.ts";
import { git } from "./git.ts";
import { entries as ledgerEntries } from "./ledger.ts";
import { activeItem } from "./state.ts";
import { canCloseAnItem, FANOUT_KINDS, JUSTIFY_FROM_ROUND, MIN_REPORT_BYTES, reportFiles, roundOf } from "./roles.ts";
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
 * How many subagents may run at once.
 *
 * Twenty by default, and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` raises or lowers
 * it, so hardcoding the number refused at 21 on a machine configured for more.
 *
 * The comment here used to say the excess "queues silently". It does not: the
 * docs say spawning fails with `Concurrent subagent limit reached` and tells
 * Claude not to retry. Stating the opposite of the documented behaviour in the
 * error a person reads while hitting it is its own small defect.
 *
 * This bounds one `plan` call, not a session. Two calls of fifteen both pass.
 */
export function concurrencyCap(): number {
  const configured = Number.parseInt(process.env["CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS"] ?? "", 10);
  return Number.isInteger(configured) && configured > 0 ? configured : 20;
}

/** The default, kept as a name for the tests and the prose that cite it. */
export const CONCURRENCY_CAP = 20;

/** A worker name has to survive being part of a filename, and stay readable. */
const WORKER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * What a worker name may not look like: a leading `r<digit>`.
 *
 * Wider than what `roundOf` reads as a round marker, on purpose. `roundOf` takes
 * `r<digits>` as a round only when nothing or a dash follows, so a file named
 * `_r2x` is a lens called `r2x` in round 1 there. A new worker is refused for
 * every `r<digit>` start anyway, so no name can sit on that line: the rule for
 * reading a file that is already on disk is narrower than the rule for naming
 * a new one, and agents/reviewer.md says both.
 */
const ROUND_LIKE = /^r\d/;

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
  if (!FANOUT_KINDS.includes(kind)) {
    throw new UserError(`'${kind}' is not a fan-out kind`, `one of: ${FANOUT_KINDS.join(", ")}`);
  }

  const item = activeItem(store);
  if (item === undefined) throw new UserError("no active item to fan out on");

  if (options.workers.length === 0) throw new UserError("fan-out needs at least one --worker");
  const cap = concurrencyCap();
  if (options.workers.length > cap) {
    throw new UserError(
      `${options.workers.length} workers exceeds the ${cap} concurrent subagents this session will run`,
      "spawning past the cap fails outright rather than queueing; fan out to what the work needs, or raise CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS",
    );
  }

  const round = options.round ?? 1;
  if (!Number.isInteger(round) || round < 1) throw new UserError("--round must be a positive integer");

  const seen = new Set<string>();
  const workers = options.workers.map((name) => {
    if (!WORKER.test(name)) {
      throw new UserError(`'${name}' is not a usable worker name`, "lowercase words joined by hyphens");
    }
    // `r2` becomes `..._r2.md`, which reads as round 2 of a lone reviewer, and
    // `r2-x` becomes `..._r2-x.md`, round 2 with lens `x`, the very path that
    // `--round 2 --worker x` allocates. Any `r<digit>` start is refused, `r2x`
    // included although `roundOf` would read it as a lens (see ROUND_LIKE).
    if (ROUND_LIKE.test(name)) {
      throw new UserError(
        `'${name}' is not a usable worker name: it would be read as a round marker`,
        "names starting r<digit> are reserved for review rounds; pick a lens name like 'reader' or 'security'",
      );
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

/**
 * A lone review report for the active item: the next round, and what to tell the reviewer.
 *
 * The round is one more than the highest round of any review report on disk,
 * lone or lensed (`review_<slug>.md` and a round-1 lens are round 1,
 * `review_<slug>_r<N>[-lens].md` is round N), so a panel counts as the round it
 * was and the third review of any shape needs its reason. From `JUSTIFY_FROM_ROUND` on, a reason is required
 * and is written as the item's `review-r<N>` decision row here, so the row the
 * gate asks for exists because the round was allocated, not because someone
 * remembered. Asking again for a round that already has its row writes none.
 */
export interface SoloPlan {
  slug: string;
  round: number;
  report: string;
  /** The last sha a reviewer recorded for the item that is still an ancestor of HEAD, if any. */
  lastReviewed: string | undefined;
  /** Whether this call wrote the decision row. */
  wroteRow: boolean;
}

export function planSolo(store: Store, options: { kind: string; justify?: string }): SoloPlan {
  if (options.kind !== "review") throw new UserError("--solo is for --kind review", "a lone report with rounds is what a review has; other kinds take --worker");
  const item = activeItem(store);
  if (item === undefined) throw new UserError("no active item to fan out on");

  let highest = 0;
  for (const file of reportFiles(store.progress, "review", item.slug)) {
    const { round } = roundOf(file, "review", item.slug);
    if (round > highest) highest = round;
  }
  const round = highest + 1;
  const name = round === 1 ? `review_${item.slug}.md` : `review_${item.slug}_r${round}.md`;
  const report = join(store.progress, name);

  let wroteRow = false;
  const reason = (options.justify ?? "").trim();
  if (round >= JUSTIFY_FROM_ROUND) {
    if (reason === "") {
      throw new UserError(
        `round ${round} of a lone review of ${item.slug} needs a reason`,
        `rounds from ${JUSTIFY_FROM_ROUND} on are written down; pass --justify "<why another round is worth it>" and the decision row (phase review-r${round}) is written for you`,
      );
    }
    const phase = `review-r${round}`;
    const have = decisions.all(store).some((d) => d.phase === phase && d.item === item.slug);
    if (!have) {
      decisions.add(store, {
        phase,
        decision: reason,
        why: `round ${round} of a lone review of ${item.slug}, allocated by 'mstack fanout plan --kind review --solo'`,
        evidence: relative(store.root, report).split(sep).join("/"),
        result: `round ${round} allowed`,
        item: item.slug,
      });
      wroteRow = true;
    }
  }
  return { slug: item.slug, round, report, lastReviewed: lastReviewedAncestor(store, item.slug), wroteRow };
}

/**
 * The newest ledger row, in file order, of a pass that is not the implementer
 * (the role `canCloseAnItem` accepts) for this item whose sha is still in HEAD's
 * history. A rebase or an abandoned branch leaves rows whose commit is not an
 * ancestor, and a diff against one of those would be a diff against nothing.
 * `git merge-base --is-ancestor` prints nothing and exits 0 for an ancestor; the
 * shared `git` helper turns every failure, including "no", into null.
 */
export function lastReviewedAncestor(store: Store, slug: string): string | undefined {
  const rows = ledgerEntries(store).filter((e) => e.target === slug && canCloseAnItem(e.verifier));
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const sha = rows[i]?.sha ?? "";
    if (sha === "" || sha.startsWith("-")) continue;
    if (git(store, ["merge-base", "--is-ancestor", sha, "HEAD"]) !== null) return sha;
  }
  return undefined;
}
