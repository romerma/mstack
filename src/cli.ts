import { parseArgs } from "node:util";

import * as decisions from "./decisions.ts";
import * as fanout from "./fanout.ts";
import { EXIT, evaluate, fetchPr } from "./mergegate.ts";
import { defaultBranch, headSha, itemLabel, runGate } from "./gate.ts";
import * as hooks from "./hooks.ts";
import * as ledger from "./ledger.ts";
import { canTransition, isActive, isStatus, STATUSES } from "./lifecycle.ts";
import { lintPlugin } from "./lint.ts";
import { requireStore, UserError } from "./paths.ts";
import { findItem, parseState, saveState, type Item } from "./state.ts";
import { setup } from "./setup.ts";
import { statusline, subagentStatusline } from "./statusline.ts";
import * as worktree from "./worktree.ts";

const USAGE = `mstack - durable state and gates for the mstack Claude Code plugin

  setup [--force]                     create .mstack/ in the current repository
  gate [--full] [--quiet]             fast session gate; --full also runs verification
  state list | active                 show work items
  state add --slug S --title T [...]  add an item
  state set <ref> --status S [...]    move an item
  ledger record <target> <sha> <verdict> --evidence E [--verifier V]
  ledger check <target> [sha] [--min V]
  ledger summary
  decide --phase P --decision D --why W --evidence E --result R
  worktree new <slug> [--prefix fix] [--base origin/main]
  worktree list
  worktree prune [--yes]
  merge-gate <pr> [--target <slug>] [--min <verdict>]
  hook <session-start|post-edit|subagent-stop|stop|pre-tool-use>
  fanout plan --kind K --worker W...  allocate one report path per parallel worker
  fanout check --kind K --worker W... name the workers that did not report back
  statusline [--subagent]             render status rows from the JSON on stdin
  lint-plugin [dir]

Exit codes: 0 pass, 1 gate failure or wait, 2 usage error or stop.
Verdicts: ${ledger.VERDICTS.join(" | ")}
Statuses: ${STATUSES.join(" | ")}`;

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case undefined:
    case "-h":
    case "--help":
    case "help":
      console.log(USAGE);
      return 0;
    case "setup":
      return cmdSetup(rest);
    case "gate":
      return cmdGate(rest);
    case "state":
      return cmdState(rest);
    case "ledger":
      return cmdLedger(rest);
    case "decide":
      return cmdDecide(rest);
    case "worktree":
      return cmdWorktree(rest);
    case "merge-gate":
      return cmdMergeGate(rest);
    case "hook":
      return await cmdHook(rest);
    case "fanout":
      return cmdFanout(rest);
    case "statusline":
      return cmdStatusline(rest);
    case "lint-plugin":
      return cmdLint(rest);
    default:
      throw new UserError(`unknown command '${command}'`, "run 'mstack help'");
  }
}

function cmdFanout(argv: readonly string[]): number {
  const [sub, ...rest] = argv;
  if (sub !== "plan" && sub !== "check") {
    throw new UserError(`fanout takes 'plan' or 'check', not '${sub ?? ""}'`);
  }
  const { values } = parseArgs({
    args: [...rest],
    options: {
      kind: { type: "string" },
      worker: { type: "string", multiple: true },
      round: { type: "string" },
    },
    strict: true,
  });
  if (values.kind === undefined) throw new UserError("fanout needs --kind");

  const store = requireStore();
  const plan = fanout.plan(store, {
    kind: values.kind,
    workers: values.worker ?? [],
    round: values.round === undefined ? undefined : Number(values.round),
  });

  if (sub === "plan") {
    console.log(`${plan.kind} fan-out on ${plan.slug}, ${plan.workers.length} worker(s):`);
    for (const worker of plan.workers) console.log(`  ${worker.name}\t${worker.report}`);
    console.log("");
    console.log("Give each worker its own path. Two workers with one filename lose a report silently.");
    return 0;
  }
  return fanout.check(store, plan).failed ? 1 : 0;
}

function cmdStatusline(argv: readonly string[]): number {
  const { values } = parseArgs({ args: [...argv], options: { subagent: { type: "boolean" } }, strict: true });
  return values.subagent === true ? subagentStatusline() : statusline();
}

function cmdSetup(argv: readonly string[]): number {
  const { values } = parseArgs({ args: [...argv], options: { force: { type: "boolean" } }, strict: true });
  return setup(process.cwd(), { force: values.force === true }).failed ? 1 : 0;
}

function cmdGate(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: { full: { type: "boolean" }, quiet: { type: "boolean" } },
    strict: true,
  });
  const report = runGate(requireStore(), {
    ...(values.full === true ? { full: true } : {}),
    ...(values.quiet === true ? { quiet: true } : {}),
  });
  return report.failed ? 1 : 0;
}

function cmdState(argv: readonly string[]): number {
  const store = requireStore();
  const [sub, ...rest] = argv;

  if (sub === "list" || sub === undefined) {
    const state = parseState(store.state);
    if (state.items.length === 0) console.log("no items");
    for (const item of state.items) {
      console.log(`${isActive(item.status) ? "*" : " "} ${itemLabel(item)}  ${item.title}`);
    }
    return 0;
  }

  if (sub === "active") {
    const item = parseState(store.state).items.find((i) => isActive(i.status));
    if (item === undefined) {
      // Note goes to stderr so stdout stays machine-consumable. Every agent file
      // tells agents to run this, and `SLUG=$(mstack state active)` must yield an
      // empty string when nothing is active, not the words "no active item".
      console.error("no active item");
      return 1;
    }
    console.log(item.slug);
    return 0;
  }

  if (sub === "add") {
    const { values } = parseArgs({
      args: [...rest],
      options: {
        slug: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        acceptance: { type: "string", multiple: true },
        sdd: { type: "boolean" },
        source: { type: "string" },
        verification: { type: "string" },
        "decision-required": { type: "string" },
      },
      strict: true,
    });
    if (values.slug === undefined || values.title === undefined) {
      throw new UserError("state add needs --slug and --title");
    }
    const state = parseState(store.state);
    const item: Item = {
      id: Math.max(0, ...state.items.map((i) => i.id)) + 1,
      slug: values.slug,
      title: values.title,
      acceptance: values.acceptance ?? [],
      status: "pending",
    };
    if (values.description !== undefined) item.description = values.description;
    if (values.sdd === true) item.sdd = true;
    if (values.source !== undefined) item.source = values.source;
    if (values.verification !== undefined) item.verification = values.verification;
    if (values["decision-required"] !== undefined) item.decision_required = values["decision-required"];
    state.items.push(item);
    saveState(store.state, state);
    console.log(`added ${itemLabel(item)}`);
    return 0;
  }

  if (sub === "set") {
    const [ref, ...flags] = rest;
    if (ref === undefined) throw new UserError("state set needs an item id or slug");
    const { values } = parseArgs({
      args: [...flags],
      options: { status: { type: "string" }, "closed-by": { type: "string" }, force: { type: "boolean" } },
      strict: true,
    });
    const state = parseState(store.state);
    const item = findItem(state, ref);
    if (item === undefined) throw new UserError(`no item matches '${ref}'`);

    if (values.status !== undefined) {
      if (!isStatus(values.status)) {
        throw new UserError(`'${values.status}' is not a status`, `one of: ${STATUSES.join(", ")}`);
      }
      if (!canTransition(item.status, values.status) && values.force !== true) {
        throw new UserError(
          `${item.status} -> ${values.status} is not a legal transition`,
          "pass --force if you mean to skip a phase, and say why in decisions.tsv",
        );
      }
      item.status = values.status;
    }
    if (values["closed-by"] !== undefined) item.closed_by = values["closed-by"];
    saveState(store.state, state);
    console.log(itemLabel(item));
    return 0;
  }

  throw new UserError(`unknown 'state' subcommand '${sub}'`);
}

function cmdLedger(argv: readonly string[]): number {
  const store = requireStore();
  const [sub, ...rest] = argv;

  if (sub === "record") {
    const [target, sha, verdict, ...flags] = rest;
    if (target === undefined || sha === undefined || verdict === undefined) {
      throw new UserError("ledger record needs <target> <sha> <verdict>");
    }
    if (!ledger.isVerdict(verdict)) {
      throw new UserError(`'${verdict}' is not a verdict`, `one of: ${ledger.VERDICTS.join(", ")}`);
    }
    const { values } = parseArgs({
      args: [...flags],
      options: { evidence: { type: "string" }, verifier: { type: "string" } },
      strict: true,
    });
    const entry = ledger.record(store, {
      target,
      sha,
      verdict,
      evidence: values.evidence ?? "",
      verifier: values.verifier ?? "",
    });
    console.log(`recorded ${entry.verdict} for ${entry.target} at ${entry.sha.slice(0, 8)}`);
    return 0;
  }

  if (sub === "check") {
    const [target, maybeSha, ...flags] = rest;
    if (target === undefined) throw new UserError("ledger check needs <target>");
    const positional = maybeSha !== undefined && !maybeSha.startsWith("--") ? maybeSha : undefined;
    const { values } = parseArgs({
      args: positional === undefined && maybeSha !== undefined ? [maybeSha, ...flags] : [...flags],
      options: { min: { type: "string" } },
      strict: true,
    });
    const sha = positional ?? headSha(store) ?? "";
    const min = values.min ?? "test-verified";
    if (!ledger.isVerdict(min)) throw new UserError(`'${min}' is not a verdict`);
    const result = ledger.check(store, target, sha, min);
    console.log(`${result.passing ? "PASS" : "FAIL"} ${result.reason}`);
    return result.passing ? 0 : 1;
  }

  if (sub === "summary" || sub === undefined) {
    const rows = ledger.entries(store);
    if (rows.length === 0) console.log("ledger is empty");
    for (const e of rows) {
      console.log(`${e.ts}  ${e.target}  ${e.sha.slice(0, 8)}  ${e.verdict}  ${e.evidence}`);
    }
    return 0;
  }

  throw new UserError(`unknown 'ledger' subcommand '${sub}'`);
}

function cmdDecide(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      phase: { type: "string" },
      decision: { type: "string" },
      why: { type: "string" },
      evidence: { type: "string" },
      result: { type: "string" },
    },
    strict: true,
  });
  if (values.decision === undefined) throw new UserError("decide needs --decision");
  decisions.add(requireStore(), {
    phase: values.phase ?? "",
    decision: values.decision,
    why: values.why ?? "",
    evidence: values.evidence ?? "",
    result: values.result ?? "open",
  });
  console.log("recorded");
  return 0;
}

function cmdWorktree(argv: readonly string[]): number {
  const store = requireStore();
  const [sub, ...rest] = argv;

  if (sub === "list" || sub === undefined) {
    for (const w of worktree.list(store)) {
      const tags = [w.isMain ? "main" : "", w.merged ? "merged" : "", w.dirty ? "dirty" : ""]
        .filter((t) => t !== "")
        .join(",");
      console.log(`${w.sha.slice(0, 8)}  ${w.branch.padEnd(34)} ${tags.padEnd(14)} ${w.path}`);
    }
    return 0;
  }

  if (sub === "new") {
    const [slug, ...flags] = rest;
    if (slug === undefined) throw new UserError("worktree new needs a slug");
    const { values } = parseArgs({
      args: [...flags],
      options: { prefix: { type: "string" }, base: { type: "string" } },
      strict: true,
    });
    const result = worktree.create(store, slug, {
      ...(values.prefix !== undefined ? { prefix: values.prefix } : {}),
      ...(values.base !== undefined ? { base: values.base } : {}),
    });
    console.log(`${result.path}\nbranch ${result.branch} from ${result.base} at ${result.baseSha.slice(0, 8)}`);
    console.log("record that base SHA in .mstack/progress/current.md before you start");
    return 0;
  }

  if (sub === "prune") {
    const { values } = parseArgs({ args: [...rest], options: { yes: { type: "boolean" } }, strict: true });
    const candidates = worktree.prunable(store);
    if (candidates.length === 0) {
      console.log(`nothing to prune (default branch: ${defaultBranch(store)})`);
      return 0;
    }
    for (const c of candidates) console.log(`${values.yes === true ? "removing" : "would remove"} ${c.info.path} - ${c.reason}`);
    if (values.yes !== true) {
      console.log("\nnothing was removed. Re-run with --yes once you have read the list.");
      return 0;
    }
    for (const c of candidates) worktree.remove(store, c.info.path);
    console.log(`removed ${candidates.length} worktree(s)`);
    return 0;
  }

  throw new UserError(`unknown 'worktree' subcommand '${sub}'`);
}

function cmdMergeGate(argv: readonly string[]): number {
  const store = requireStore();
  const [pr, ...flags] = argv;
  if (pr === undefined) throw new UserError("merge-gate needs a PR number or URL");
  const { values } = parseArgs({
    args: [...flags],
    options: { target: { type: "string" }, min: { type: "string" } },
    strict: true,
  });
  const min = values.min ?? "test-verified";
  if (!ledger.isVerdict(min)) throw new UserError(`'${min}' is not a verdict`);

  const data = fetchPr(store, pr);
  // Silently dropping the ledger check when no target could be found turned the
  // merge gate into a check-status mirror: green CI, no verdict consulted, GO.
  // The one thing this gate adds over `gh pr checks` is the verdict.
  const target = values.target ?? parseState(store.state).items.find((i) => isActive(i.status))?.slug;
  if (target === undefined) {
    throw new UserError(
      "no active item, so there is nothing to check the ledger against",
      "pass --target <slug>; without it this would only be repeating what gh already told you",
    );
  }
  const verdict = evaluate(data, { ledger: { store, target, min } });

  console.log(`${verdict.decision} - PR #${data.number} at ${verdict.headSha.slice(0, 8)}`);
  for (const reason of verdict.reasons) console.log(`  ${reason}`);
  return EXIT[verdict.decision];
}

async function cmdHook(argv: readonly string[]): Promise<number> {
  const [event] = argv;
  const input = hooks.readInput(await readStdin());
  try {
    const output = handleHook(event, input);
    if (output !== null) process.stdout.write(output);
  } catch {
    // A hook that throws becomes a visible hook error for the user. Nothing
    // this file does is important enough to be worth that, so it fails open.
  }
  return 0;
}

function handleHook(event: string | undefined, input: ReturnType<typeof hooks.readInput>): string | null {
  switch (event) {
    case "session-start":
      return hooks.sessionStart(input);
    case "post-edit":
      return hooks.postEdit(input);
    case "subagent-stop":
      return hooks.subagentStop(input);
    case "stop":
      return hooks.stop(input);
    case "pre-tool-use":
      return hooks.preToolUse(input);
    default:
      return null;
  }
}

function cmdLint(argv: readonly string[]): number {
  const [dir] = argv;
  return lintPlugin(dir ?? process.cwd()).failed ? 1 : 0;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY === true) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UserError) {
    console.error(`mstack: ${error.message}`);
    if (error.fix !== undefined) console.error(`        ${error.fix}`);
    process.exitCode = 2;
  } else {
    console.error(`mstack: ${(error as Error).message}`);
    process.exitCode = 2;
  }
}
