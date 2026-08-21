import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import * as decisions from "./decisions.ts";
import * as fanout from "./fanout.ts";
import { EXIT, evaluate, fetchPr } from "./mergegate.ts";
import { defaultBranch, headSha, itemLabel, runGate } from "./gate.ts";
import * as hooks from "./hooks.ts";
import * as ledger from "./ledger.ts";
import {
  canTransition,
  isActive,
  isStatus,
  requiresDecision,
  requiresSpecArtifacts,
  STATUSES,
} from "./lifecycle.ts";
import { lintPlugin } from "./lint.ts";
import { requireStore, UserError } from "./paths.ts";
import { assertWritable, findItem, parseState, saveState, type Item } from "./state.ts";
import { MIN_REPORT_BYTES } from "./roles.ts";

/** A few words. Enough that "x" is out and "versioned envelope" is in. */
const MIN_PHRASE = 12;
import { setup } from "./setup.ts";
import { statusline, subagentStatusline } from "./statusline.ts";
import * as worktree from "./worktree.ts";

const USAGE = `mstack - durable state and gates for the mstack Claude Code plugin

  setup [--force]                     create .mstack/ in the current repository
  gate [--full] [--quiet]             fast session gate; --full also runs verification
  state list | active                 show work items
  state add --slug S --title T [...]  add an item
  state set <ref> [--status S] [...]  move or correct an item
  state set <ref> --clear <field>     remove a field an item carries
  ledger record <target> <sha> <verdict> --evidence E [--verifier V]
  ledger check <target> [sha] [--min V]
  ledger summary
  decide --phase P --decision D --why W --evidence E --result R [--resolves <ref>]
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

/**
 * The only subcommand that parses leniently, and for the same reason the rest
 * of this file's status line code is written the way it is: it runs on every
 * assistant message, and it must never be the thing that breaks a session.
 *
 * Strict parsing meant a typo in a user's settings.json — `--subagents` for
 * `--subagent` — exited 2 and wrote to stderr, which is a dead bar with an
 * error message on it. Everywhere else a typo should be loud, because
 * everywhere else a human is reading the output.
 */
/**
 * A subcommand that takes nothing must say so when handed something.
 *
 * `state list --nope` and `ledger summary --x` used to succeed silently: the
 * extra argv was destructured into `rest` and never looked at. A flag that is
 * accepted and ignored is indistinguishable from a flag that worked, which is
 * how someone ends up believing a filter is applied.
 */
function takesNothing(command: string, rest: readonly string[]): void {
  if (rest.length > 0) {
    throw new UserError(`${command} takes no arguments, got '${rest.join(" ")}'`, "run 'mstack help'");
  }
}

function cmdStatusline(argv: readonly string[]): number {
  // Prefix match, not equality: `--subagents` should render subagent rows, not
  // silently fall through to the main bar and emit a line of text where the
  // caller is parsing JSON.
  // `--subagent=false` used to turn subagent mode on, because the prefix match
  // never looked at the value.
  const subagent = argv.some((arg) => {
    if (!arg.startsWith("--subagent")) return false;
    const eq = arg.indexOf("=");
    return eq === -1 || !/^(false|0|no|off)$/i.test(arg.slice(eq + 1));
  });
  return subagent ? subagentStatusline() : statusline();
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

/** Fields `state set` can remove, spelled as the flag that sets them. */
const CLEARABLE = {
  description: "description",
  source: "source",
  verification: "verification",
  "decision-required": "decision_required",
  sdd: "sdd",
  "closed-by": "closed_by",
} as const satisfies Readonly<Record<string, keyof Item>>;

/** Fields every item always has, with the reason each one cannot be removed. */
const UNCLEARABLE: Readonly<Record<string, string>> = {
  acceptance: "the gate fails an item with an empty acceptance list; replace them with --acceptance instead",
  title: "an item needs a title; replace it with --title instead",
  status: "an item is always in some status; move it with --status instead",
  slug: "the slug names the branch, the spec directory and the progress files",
};

/** How much of a long field to echo back when reporting what changed. */
const PREVIEW = 48;

function preview(value: string | boolean | undefined): string {
  if (value === undefined) return "(unset)";
  if (typeof value === "boolean") return String(value);
  const flat = value.replace(/\s+/g, " ").trim();
  return `"${flat.length > PREVIEW ? `${flat.slice(0, PREVIEW - 3)}...` : flat}"`;
}

/**
 * The unabbreviated value, with its length and its escapes.
 *
 * The length is not decoration. It is what distinguishes two values whose
 * printed forms look identical — a doubled space, a tab, a trailing newline —
 * in the one place where looking identical is the bug.
 */
function detail(value: string | boolean | undefined): string {
  if (value === undefined) return "(unset)";
  if (typeof value === "boolean") return String(value);
  return `(${value.length} chars) ${JSON.stringify(value)}`;
}

/**
 * One line per field the command touched.
 *
 * `state set` printed the item label and nothing else, which was enough while
 * the only field it could change was the status, because the label carries
 * that. It is not enough for a flag that replaces a list of quoted acceptance
 * criteria: a write nobody sees is indistinguishable from a no-op, and what it
 * overwrote is gone.
 *
 * Every caller has already established that the two values differ, so equal
 * previews mean the abbreviation is hiding the change rather than that there
 * is none. Review caught this rendering as
 *
 *   decision_required: "Should the export be a stable public contract..." -> "Should the export be a stable public contract..."
 *   decision_resolved: "2026-08-21T09:40:18.366Z" -> (unset)
 *
 * on two forks sharing a 45-character prefix: the same line that exists to make
 * a write visible, printing no visible change, on the one field where this
 * command silently un-answers a fork. When the previews collide the values go
 * out in full instead.
 */
function fieldChange(field: string, from: string | boolean | undefined, to: string | boolean | undefined): string[] {
  const before = preview(from);
  const after = preview(to);
  if (before !== after) return [`  ${field}: ${before} -> ${after}`];
  return [
    `  ${field}: changed, and the short forms match, so both in full`,
    `    was ${detail(from)}`,
    `    now ${detail(to)}`,
  ];
}

/**
 * An empty string is not a value, and surrounding whitespace is not part of one.
 *
 * `--description ""` reads as "set it to nothing", which is the same intent as
 * removing the field and a different result: a key whose value is `""` survives
 * the round trip through state.json and reads back as present-but-blank. That
 * is a third state nobody asked for, and the two files already disagree about
 * it — `src/gate.ts` treats a `decision_required` of `""` as no fork at all.
 * One spelling for removal, and it says the word.
 *
 * The trim is the same argument one step in. This validated with `.trim()` and
 * stored the raw value, so `"$FORK "` and `"$FORK"` were different prose: a
 * trailing space re-opened an answered fork and dropped its `decision_resolved`
 * pointer, printing two lines a reader cannot tell apart. Nothing downstream
 * has ever meant anything by leading or trailing whitespace.
 */
function required(flag: string, value: string, fix: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new UserError(`an empty ${flag} is not a value`, fix);
  return trimmed;
}

function clearField(item: Item, name: string): string[] {
  const blocked = UNCLEARABLE[name];
  if (blocked !== undefined) throw new UserError(`${name} cannot be cleared`, blocked);
  const key = (CLEARABLE as Readonly<Record<string, keyof Item>>)[name];
  if (key === undefined) {
    throw new UserError(`'${name}' is not a field 'state set' can clear`, `one of: ${Object.keys(CLEARABLE).join(", ")}`);
  }
  const before = item[key];
  if (before === undefined) return [`  ${key}: already unset`];
  const lines = fieldChange(key, before as string | boolean, undefined);
  // The answer named the question. With the question gone the pointer leads to
  // a row about a fork this item no longer carries, and a different fork
  // attached later would find that pointer and be born answered.
  if (key === "decision_required" && item.decision_resolved !== undefined) {
    lines.push(...fieldChange("decision_resolved", item.decision_resolved, undefined));
    delete item.decision_resolved;
  }
  delete item[key];
  return lines;
}

function cmdState(argv: readonly string[]): number {
  const store = requireStore();
  const [sub, ...rest] = argv;

  if (sub === "list" || sub === undefined) {
    takesNothing("state list", rest);
    const state = parseState(store.state);
    if (state.items.length === 0) console.log("no items");
    for (const item of state.items) {
      console.log(`${isActive(item.status) ? "*" : " "} ${itemLabel(item)}  ${item.title}`);
    }
    return 0;
  }

  if (sub === "active") {
    takesNothing("state active", rest);
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
    // Both writers, one rule. The empty-string trap was closed in `state set`
    // and left open here, so `state add --description "" --decision-required ""`
    // still wrote every shape `state set` refuses — including the
    // `decision_required: ""` that `src/gate.ts` reads as no fork at all — and
    // the gate called it green. A rule enforced in one of two doors is a rule
    // with a documented way around it.
    const item: Item = {
      id: Math.max(0, ...state.items.map((i) => i.id)) + 1,
      slug: values.slug,
      title: required("--title", values.title, "an item needs a title; it is the one field that cannot be removed"),
      acceptance: (values.acceptance ?? []).map((a) =>
        required("--acceptance", a, "a criterion has to say something; quote it from the source"),
      ),
      status: "pending",
    };
    if (values.description !== undefined) {
      item.description = required("--description", values.description, "leave the flag off instead");
    }
    if (values.sdd === true) item.sdd = true;
    if (values.source !== undefined) item.source = required("--source", values.source, "leave the flag off instead");
    if (values.verification !== undefined) {
      item.verification = required("--verification", values.verification, "leave the flag off instead");
    }
    if (values["decision-required"] !== undefined) {
      item.decision_required = required(
        "--decision-required",
        values["decision-required"],
        "leave the flag off instead; an empty fork is not a fork, and the gate would read it as none",
      );
    }
    state.items.push(item);
    assertWritable(item, state);
    saveState(store.state, state);
    console.log(`added ${itemLabel(item)}`);
    return 0;
  }

  if (sub === "set") {
    const [ref, ...flags] = rest;
    if (ref === undefined) throw new UserError("state set needs an item id or slug");
    const { values } = parseArgs({
      args: [...flags],
      options: {
        status: { type: "string" },
        "closed-by": { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        acceptance: { type: "string", multiple: true },
        "add-acceptance": { type: "string", multiple: true },
        sdd: { type: "boolean" },
        source: { type: "string" },
        verification: { type: "string" },
        "decision-required": { type: "string" },
        clear: { type: "string", multiple: true },
        slug: { type: "string" },
        force: { type: "boolean" },
      },
      strict: true,
    });
    const state = parseState(store.state);
    const item = findItem(state, ref);
    if (item === undefined) throw new UserError(`no item matches '${ref}'`);

    // Every other field is a value in this file and nowhere else. The slug is
    // the branch, the spec directory, the progress filenames, every ledger
    // target and every `resolves` value already written, and none of those move
    // when this one does — so renaming it here would orphan them all silently.
    if (values.slug !== undefined) {
      throw new UserError(
        "state set cannot rename a slug",
        "it names the branch, the spec directory, the progress files and every ledger and decision row already written for this item; none of those move with it",
      );
    }

    const clears = values.clear ?? [];
    const instructions =
      clears.length +
      [
        values.status,
        values["closed-by"],
        values.title,
        values.description,
        values.acceptance,
        values["add-acceptance"],
        values.sdd,
        values.source,
        values.verification,
        values["decision-required"],
      ].filter((v) => v !== undefined).length;
    // `state set 3` used to rewrite the file unchanged and print the label,
    // which is the shape `takesNothing` exists to stop elsewhere: a command that
    // did nothing is indistinguishable from a flag that worked.
    if (instructions === 0) {
      throw new UserError(
        `state set ${ref} was given nothing to set`,
        `pass --status, --clear <field>, or a value flag: ${Object.keys(CLEARABLE).join(", ")}, title, acceptance, add-acceptance`,
      );
    }
    for (const [flag, given] of [
      ["description", values.description !== undefined],
      ["source", values.source !== undefined],
      ["verification", values.verification !== undefined],
      ["decision-required", values["decision-required"] !== undefined],
      ["closed-by", values["closed-by"] !== undefined],
      ["sdd", values.sdd === true],
    ] as const) {
      if (given && clears.includes(flag)) {
        throw new UserError(
          `--${flag} and --clear ${flag} in one command contradict each other`,
          "run one or the other; which one won would depend on an order this CLI does not promise",
        );
      }
    }
    if (values.acceptance !== undefined && values["add-acceptance"] !== undefined) {
      throw new UserError(
        "--acceptance replaces the list and --add-acceptance appends to it, so one command cannot do both",
        "pass every criterion you want to --acceptance, or only the new ones to --add-acceptance",
      );
    }

    const changes: string[] = [];

    // Clears first, then the status move, then the values. The order is what
    // makes both single-command shapes work: dropping a fork and moving on, and
    // moving an item back before attaching one. `--decision-required` is applied
    // last for the same reason — its gate has to judge the status the item ends
    // up in, not the one it started from.
    for (const name of clears) changes.push(...clearField(item, name));

    if (values.status !== undefined) {
      if (!isStatus(values.status)) {
        throw new UserError(`'${values.status}' is not a status`, `one of: ${STATUSES.join(", ")}`);
      }
      // Refused here as well as in the gate. The gate is the authority; this is
      // the cheapest place to say so, before anything is built on the answer.
      if (
        requiresDecision(values.status) &&
        (item.decision_required ?? "") !== "" &&
        (item.decision_resolved ?? "") === "" &&
        values.force !== true
      ) {
        throw new UserError(
          `${item.slug} has an unanswered decision: "${item.decision_required}"`,
          "answer it with 'mstack decide --resolves " + item.slug + " ...' first",
        );
      }
      if (!canTransition(item.status, values.status) && values.force !== true) {
        throw new UserError(
          `${item.status} -> ${values.status} is not a legal transition`,
          "pass --force if you mean to skip a phase, and say why in decisions.tsv",
        );
      }
      if (item.status !== values.status) changes.push(...fieldChange("status", item.status, values.status));
      item.status = values.status;
    }

    for (const [flag, key, given] of [
      ["--title", "title", values.title],
      ["--description", "description", values.description],
      ["--source", "source", values.source],
      ["--verification", "verification", values.verification],
      ["--closed-by", "closed_by", values["closed-by"]],
    ] as const) {
      if (given === undefined) continue;
      const next = required(
        flag,
        given,
        key === "title"
          ? "an item needs a title, and it is the one field 'state set' cannot remove"
          : `to remove a field, say so: 'mstack state set ${item.slug} --clear ${flag.slice(2)}'`,
      );
      if (item[key] !== next) changes.push(...fieldChange(key, item[key], next));
      item[key] = next;
    }

    if (values.acceptance !== undefined) {
      const next = values.acceptance.map((a) =>
        required("--acceptance", a, "a criterion has to say something; quote it from the source"),
      );
      changes.push(`  acceptance: ${item.acceptance.length} criterion(s) replaced with ${next.length}`);
      for (const dropped of item.acceptance) changes.push(`    - dropped ${preview(dropped)}`);
      item.acceptance = next;
    }
    if (values["add-acceptance"] !== undefined) {
      const added = values["add-acceptance"].map((a) =>
        required("--add-acceptance", a, "a criterion has to say something; quote it from the source"),
      );
      item.acceptance = [...item.acceptance, ...added];
      changes.push(`  acceptance: ${added.length} added, now ${item.acceptance.length}`);
    }
    if (values.sdd === true && item.sdd !== true) {
      changes.push(...fieldChange("sdd", item.sdd, true));
      item.sdd = true;
      // The same announcement the fork path makes, for the same reason and on
      // review's insistence: `--sdd` on an item already past `specifying` took
      // a green gate to red at exit 0, which is the shape this file's own
      // comment at the status check argues against — the gate is the authority,
      // and this is the cheapest place to say so.
      //
      // The disk is read rather than assumed, because the two cases are
      // genuinely different and a line claiming a failure that did not happen
      // would be worse than no line. Existence only: whether four present
      // artifacts are also complete is the gate's judgement, not this one's.
      if (requiresSpecArtifacts(item.status)) {
        const dir = join(store.specs, item.slug);
        changes.push(
          existsSync(dir)
            ? `  forced: ${item.slug} is ${item.status}, so 'mstack gate' now holds it to a complete spec at ${dir}`
            : `  forced: ${item.slug} is ${item.status} with no spec at ${dir}, so 'mstack gate' fails until one is written or the item moves back to specifying`,
        );
      }
    }

    if (values["decision-required"] !== undefined) {
      const fork = required(
        "--decision-required",
        values["decision-required"],
        `to remove a fork, say so: 'mstack state set ${item.slug} --clear decision-required'`,
      );
      // Identical prose is left alone, so re-stating a fork stays idempotent.
      // `required` trims, so a trailing space is the same fork rather than a
      // rewrite that would drop the answer and print two lines nobody can tell
      // apart.
      if (fork !== item.decision_required) {
        // The same line the status move is refused across, guarded in the other
        // direction. Attaching a fork to an item already sitting past it would
        // put the item past a gate it never passed, and `mstack gate` would then
        // report a state this command had just created.
        if (requiresDecision(item.status) && values.force !== true) {
          throw new UserError(
            `${item.slug} is ${item.status}, at or past the point where a fork must already be answered`,
            `park it first ('mstack state set ${item.slug} --status blocked --decision-required ...'), or pass --force to attach it where it stands and let the gate report it`,
          );
        }
        changes.push(...fieldChange("decision_required", item.decision_required, fork));
        // The answer named the question it answered. Left in place across a
        // rewrite, the pointer would make the new fork read as already answered:
        // the gate matches a row on its timestamp and the slug it resolves, and
        // never on the question.
        if (item.decision_resolved !== undefined) {
          changes.push(...fieldChange("decision_resolved", item.decision_resolved, undefined));
          delete item.decision_resolved;
        }
        item.decision_required = fork;
        if (requiresDecision(item.status)) {
          changes.push(
            `  forced: ${item.slug} is ${item.status} and now carries an unanswered fork, so 'mstack gate' fails until 'mstack decide --resolves ${item.slug} ...' answers it`,
          );
        }
      }
    }

    // A belt, and deliberately not load-bearing today: with `--slug` refused
    // and `--title ""` caught by `required`, nothing this branch can write
    // violates it. It stands so that whatever makes the slug or the title
    // editable next has to pass the same check `state add` does.
    assertWritable(item, state);
    saveState(store.state, state);
    console.log(itemLabel(item));
    for (const line of changes) console.log(line);
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
    takesNothing("ledger summary", rest);
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
      resolves: { type: "string" },
    },
    strict: true,
  });
  if (values.decision === undefined) throw new UserError("decide needs --decision");
  const store = requireStore();

  // The row and the pointer are written together so neither can exist alone: a
  // pointer with no row is a claim with no evidence, and a row nothing points at
  // does not unblock the item it answers.
  let item: Item | undefined;
  let state: ReturnType<typeof parseState> | undefined;
  if (values.resolves !== undefined) {
    state = parseState(store.state);
    item = findItem(state, values.resolves);
    if (item === undefined) throw new UserError(`no item matches '${values.resolves}'`);
    if ((item.decision_required ?? "") === "") {
      throw new UserError(
        `${item.slug} carries no decision_required, so there is no fork to resolve`,
        "record the decision without --resolves; every decision is worth a row, only a fork blocks an item",
      );
    }
  }

  if (item !== undefined) {
    // A fork answered with a blank decision, or with the default result of
    // "open", is not answered. Refusing here keeps the row honest; the gate
    // refuses the same shapes because the row can also be hand-written.
    if (!/[a-z0-9]/i.test(values.decision)) {
      throw new UserError("resolving a fork needs a decision that says something");
    }
    const result = (values.result ?? "").trim();
    if (result === "" || result === "open") {
      throw new UserError(
        "resolving a fork needs --result: what the answer actually is",
        "a result of 'open' is the default, and an open decision does not close a fork",
      );
    }
    // The same floor spec artifacts and subagent reports clear. Without it,
    // `--decision x --result y` answered a product fork with two characters and
    // an empty reasoning column — a boolean with extra steps, which is the
    // phrase this whole mechanism exists to avoid earning.
    // Two floors, because the columns are different jobs. A decision should be
    // crisp — the log's own rule is that a row fits on one line — so it needs
    // to be more than a token and no more. The reasoning and the evidence are
    // what a reader consults later, and they clear the same floor a subagent
    // report and a spec artifact do.
    for (const [flag, value, floor] of [
      ["--decision", values.decision, MIN_PHRASE],
      ["--result", values.result ?? "", MIN_PHRASE],
      ["--why", values.why ?? "", MIN_REPORT_BYTES],
      ["--evidence", values.evidence ?? "", MIN_REPORT_BYTES],
    ] as const) {
      if (value.trim().length < floor) {
        throw new UserError(
          `resolving a fork needs ${flag} to say something; got ${value.trim().length} characters, ${flag === "--why" || flag === "--evidence" ? "and this is the column a reader consults later" : "and a token is not an answer"}`,
          "answer it properly or leave the fork open; a row nobody can read is the boolean this mechanism exists to avoid",
        );
      }
    }
  }

  const written = decisions.add(store, {
    phase: values.phase ?? "",
    decision: values.decision,
    why: values.why ?? "",
    evidence: values.evidence ?? "",
    result: values.result ?? "open",
    resolves: item?.slug ?? "",
  });

  if (item !== undefined && state !== undefined) {
    item.decision_resolved = written.ts;
    saveState(store.state, state);
    console.log(`recorded, and ${item.slug} no longer has an open fork`);
    return 0;
  }
  console.log("recorded");
  return 0;
}

function cmdWorktree(argv: readonly string[]): number {
  const store = requireStore();
  const [sub, ...rest] = argv;

  if (sub === "list" || sub === undefined) {
    takesNothing("worktree list", rest);
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
