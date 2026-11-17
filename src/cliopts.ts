import { parseArgs } from "node:util";

import { UserError } from "./paths.ts";

/**
 * One flag of one command: what the parser accepts and what `--help` says.
 *
 * The parser's options and the help text are both read from the same table, so a
 * flag cannot exist in one and be missing from the other. The global help was
 * hand-written, and it is why `state add`'s flags were not in it.
 */
export interface FlagSpec {
  readonly type: "string" | "boolean";
  readonly multiple?: true;
  /** The placeholder printed after the flag in help, e.g. `<status>`. Strings only. */
  readonly arg?: string;
  readonly help: string;
}

export interface CommandSpec {
  /** The invocation as help prints it, e.g. `state set <ref> [flags]`. */
  readonly usage: string;
  readonly summary: string;
  readonly flags: Readonly<Record<string, FlagSpec>>;
}

export const STATE_ADD = {
  usage: "state add --slug S --title T [flags]",
  summary: "add an item; its id is the next free one and its status is pending",
  flags: {
    slug: { type: "string", arg: "<slug>", help: "kebab-case name of the item (required)" },
    title: { type: "string", arg: "<title>", help: "one line saying what the item is (required)" },
    description: { type: "string", arg: "<text>", help: "longer prose about the item" },
    acceptance: { type: "string", multiple: true, arg: "<criterion>", help: "one acceptance criterion, quoted from the source; repeat for each" },
    sdd: { type: "boolean", help: "take the spec path (spec.md, design.md, tasks.md) instead of the direct one" },
    source: { type: "string", arg: "<ref>", help: "where the work came from: an issue reference or 'direct request'" },
    verification: { type: "string", arg: "<command>", help: "the exact command that proves the item works" },
    "decision-required": { type: "string", arg: "<fork>", help: "prose naming a product fork that a person has to answer first" },
    seam: { type: "string", multiple: true, arg: "<surface>", help: "a public surface where a test attaches; repeat for each" },
  },
} as const satisfies CommandSpec;

export const STATE_SET = {
  usage: "state set <ref> [flags]",
  summary: "move or correct an item; <ref> is an id or a slug",
  flags: {
    status: { type: "string", arg: "<status>", help: "move the item to this status" },
    "closed-by": { type: "string", arg: "<note>", help: "why or how the item closed" },
    title: { type: "string", arg: "<title>", help: "replace the title" },
    description: { type: "string", arg: "<text>", help: "replace the description" },
    acceptance: { type: "string", multiple: true, arg: "<criterion>", help: "REPLACE the whole acceptance list with these criteria; to append use --add-acceptance" },
    "add-acceptance": { type: "string", multiple: true, arg: "<criterion>", help: "append a criterion to the existing list; repeat for each" },
    sdd: { type: "boolean", help: "take the spec path" },
    source: { type: "string", arg: "<ref>", help: "replace the source" },
    verification: { type: "string", arg: "<command>", help: "replace the verification command" },
    "decision-required": { type: "string", arg: "<fork>", help: "attach a product fork, or replace the one the item carries" },
    seam: { type: "string", multiple: true, arg: "<surface>", help: "REPLACE the seams with these; repeat for each" },
    clear: { type: "string", multiple: true, arg: "<field>", help: "remove a field the item carries; repeat for each" },
    slug: { type: "string", arg: "<slug>", help: "refused: a slug cannot be renamed" },
    force: { type: "boolean", help: "skip a phase, or close past a failed check; --closed-by must say why" },
  },
} as const satisfies CommandSpec;

export const STATE_SHOW = {
  usage: "state show <ref> [--json]",
  summary: "print one item with every field it carries; <ref> is an id or a slug",
  flags: {
    json: { type: "boolean", help: "print the item's raw object from state.json as JSON instead" },
  },
} as const satisfies CommandSpec;

export const DECIDE = {
  usage: "decide --phase P --decision D --why W --evidence E --result R [--resolves <ref>]",
  summary: "append one row to .mstack/decisions.tsv; --resolves also answers that item's fork",
  flags: {
    phase: { type: "string", arg: "<phase>", help: "where in the work the decision was taken, e.g. design or implement" },
    decision: { type: "string", arg: "<text>", help: "the decision, on one line (required)" },
    why: { type: "string", arg: "<text>", help: "the reasoning, including the alternative that lost" },
    evidence: { type: "string", arg: "<text>", help: "what the decision rests on" },
    result: { type: "string", arg: "<text>", help: "the outcome; 'open' means undecided" },
    resolves: { type: "string", arg: "<ref>", help: "the item (id or slug) whose decision_required this answers" },
  },
} as const satisfies CommandSpec;

type Flags = Readonly<Record<string, FlagSpec>>;

/** The shape `parseArgs` takes, keeping each flag's literal type so `values` stays typed. */
type Options<F extends Flags> = {
  [K in keyof F]: F[K] extends { readonly multiple: true }
    ? { type: F[K]["type"]; multiple: true }
    : { type: F[K]["type"] };
};

function optionsOf<F extends Flags>(flags: F): Options<F> {
  const out: Record<string, { type: "string" | "boolean"; multiple?: true }> = {};
  for (const [name, spec] of Object.entries(flags)) {
    out[name] = spec.multiple === true ? { type: spec.type, multiple: true } : { type: spec.type };
  }
  return out as Options<F>;
}

/** `--help` or `-h` as a whole argument. `--title=--help` is a value, not a request. */
export function wantsHelp(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--help" || arg === "-h");
}

export function helpText(spec: CommandSpec): string {
  const labels = Object.entries(spec.flags).map(([name, flag]) => [
    flag.type === "string" ? `--${name} ${flag.arg ?? "<value>"}` : `--${name}`,
    flag.help,
  ] as const);
  const width = Math.max(...labels.map(([label]) => label.length));
  return [
    `mstack ${spec.usage}`,
    `  ${spec.summary}`,
    "",
    "flags:",
    ...labels.map(([label, help]) => `  ${label.padEnd(width)}  ${help}`),
    "  --help, -h".padEnd(width + 2) + "  print this and exit 0",
  ].join("\n");
}

export function parseFlags<F extends Flags>(spec: { readonly flags: F }, args: readonly string[]) {
  return parseArgs({ args: [...args], options: optionsOf(spec.flags), strict: true });
}
