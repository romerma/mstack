import { readFileSync, writeFileSync } from "node:fs";

import { isActive, isStatus, type Status } from "./lifecycle.ts";
import { UserError, type Store } from "./paths.ts";

export interface Item {
  id: number;
  /** kebab-case. Names the spec directory, the branch, and the progress files. */
  slug: string;
  title: string;
  description?: string;
  /** Quoted from the source, never paraphrased. The gate rejects an empty list. */
  acceptance: string[];
  status: Status;
  /** Opt in to the spec path. Absent means the direct path. */
  sdd?: boolean;
  /** Prose naming an unresolved product fork. Its presence triggers the human gate. */
  decision_required?: string;
  /**
   * The `ts` of the `decisions.tsv` row that answered the fork.
   *
   * A pointer rather than a copy of the answer: the row carries the reasoning,
   * the evidence and the result, and duplicating any of that here would give it
   * somewhere to drift to. Written only by `mstack decide --resolves`, which
   * writes the row and the pointer in one step so neither can exist alone.
   */
  decision_resolved?: string;
  /** Where the work came from: an issue reference, or "direct request". */
  source?: string;
  /** The exact command that proves this item works. */
  verification?: string;
  closed_by?: string;
}

export interface State {
  version: number;
  project: string;
  description?: string;
  /** Project-level verification command. `mstack gate --full` runs it. */
  verify?: string;
  rules: {
    one_active_item: boolean;
    require_verdict_to_close: boolean;
    require_spec_for_sdd_items: boolean;
  };
  items: Item[];
}

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Refuse to write what this file would refuse to read.
 *
 * `state add` never checked the slug it was given, so one command wrote a
 * `state.json` its own parser rejects: `state list` exited 2, the gate exited
 * 1, the status line said "unreadable", and `state set` could not repair it
 * because it parses before it writes. Recovery meant hand-editing JSON. The
 * shape check guarded the read path while the writer walked straight past it.
 */
export function assertWritable(item: Item, state: State): void {
  if (!SLUG.test(item.slug)) {
    throw new UserError(
      `'${item.slug}' is not a usable slug`,
      "lowercase words joined by hyphens; it names the branch, the spec directory and the progress files",
    );
  }
  if (item.title.trim() === "") throw new UserError("an item needs a title");
  if (state.items.some((other) => other !== item && other.slug === item.slug)) {
    throw new UserError(`an item with slug '${item.slug}' already exists`);
  }
  if (state.items.some((other) => other !== item && other.id === item.id)) {
    throw new UserError(`an item with id ${item.id} already exists`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse and shape-check the state file.
 *
 * The shape check is the whole point, and it exists because of a real defect in
 * enxvo's gate. `jq empty` only proves a file parses; `{"features": {}}` passes
 * it, every query downstream then errors to stderr, the shell comparisons
 * receive empty strings and never fire, and the gate reports success while
 * enforcing nothing. A check that passes when its own queries break is the exact
 * failure this gate exists to catch, so every field is proven before any
 * invariant is evaluated against it.
 */
export function parseState(file: string): State {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new UserError(`cannot read ${file}`, "run 'mstack setup' to create it");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new UserError(
      `${file} is not valid JSON: ${(error as Error).message}`,
      "fix the syntax; the gate cannot enforce anything against an unparseable file",
    );
  }

  if (!isRecord(parsed)) {
    throw new UserError(`${file} must be a JSON object, got ${describe(parsed)}`);
  }
  if (!Array.isArray(parsed["items"])) {
    throw new UserError(
      `${file} parses but has the wrong shape: .items must be an array, got ${describe(parsed["items"])}`,
      "this is the shape that silently disables every check below it",
    );
  }
  const items = parsed["items"].map((item, index) => parseItem(item, index, file));

  const rules = isRecord(parsed["rules"]) ? parsed["rules"] : {};
  return {
    version: typeof parsed["version"] === "number" ? parsed["version"] : 1,
    project: typeof parsed["project"] === "string" ? parsed["project"] : "unnamed",
    ...(typeof parsed["description"] === "string" ? { description: parsed["description"] } : {}),
    ...(typeof parsed["verify"] === "string" ? { verify: parsed["verify"] } : {}),
    rules: {
      one_active_item: rules["one_active_item"] !== false,
      require_verdict_to_close: rules["require_verdict_to_close"] !== false,
      require_spec_for_sdd_items: rules["require_spec_for_sdd_items"] !== false,
    },
    items,
  };
}

function parseItem(value: unknown, index: number, file: string): Item {
  const at = `${file} .items[${index}]`;
  if (!isRecord(value)) {
    throw new UserError(`${at} must be an object, got ${describe(value)}`);
  }
  if (typeof value["id"] !== "number" || !Number.isInteger(value["id"])) {
    throw new UserError(`${at}.id must be an integer, got ${describe(value["id"])}`);
  }
  if (typeof value["slug"] !== "string" || !SLUG.test(value["slug"])) {
    throw new UserError(
      `${at}.slug must be kebab-case, got ${describe(value["slug"])}`,
      "the slug names the spec directory, the branch and the progress files",
    );
  }
  if (typeof value["title"] !== "string" || value["title"].trim() === "") {
    throw new UserError(`${at}.title must be a non-empty string`);
  }
  if (!isStatus(value["status"])) {
    throw new UserError(
      `${at}.status is ${describe(value["status"])}`,
      "see the lifecycle in the mstack README for the valid set",
    );
  }
  const acceptance = value["acceptance"];
  if (!Array.isArray(acceptance) || acceptance.some((a) => typeof a !== "string")) {
    throw new UserError(`${at}.acceptance must be an array of strings, got ${describe(acceptance)}`);
  }

  const item: Item = {
    id: value["id"],
    slug: value["slug"],
    title: value["title"],
    acceptance: acceptance as string[],
    status: value["status"],
  };
  if (typeof value["description"] === "string") item.description = value["description"];
  if (value["sdd"] === true) item.sdd = true;
  if (typeof value["decision_required"] === "string") item.decision_required = value["decision_required"];
  if (typeof value["decision_resolved"] === "string") item.decision_resolved = value["decision_resolved"];
  if (typeof value["source"] === "string") item.source = value["source"];
  if (typeof value["verification"] === "string") item.verification = value["verification"];
  if (typeof value["closed_by"] === "string") item.closed_by = value["closed_by"];
  return item;
}

function describe(value: unknown): string {
  if (value === undefined) return "nothing";
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === "object") return "an object";
  return JSON.stringify(value);
}

export function saveState(file: string, state: State): void {
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/**
 * Resolve an item by slug or by id, and never by accident.
 *
 * `Number.parseInt` stops at the first non-digit, so `parseInt("2fa-login")` is
 * 2: `mstack state set 2fa-login` moved whichever item happened to be id 2, and
 * `mstack decide --resolves 2fa` attached the reasoning to a different item's
 * fork. Both exited 0. A reference has to be all digits before it is a number.
 */
export function findItem(state: State, ref: string): Item | undefined {
  const bySlug = state.items.find((item) => item.slug === ref);
  if (bySlug !== undefined) return bySlug;
  if (!/^\d+$/.test(ref)) return undefined;
  const id = Number(ref);
  return state.items.find((item) => item.id === id);
}

/**
 * The one item being worked on here, if any.
 *
 * Tolerates a broken store on purpose: every caller is a hook, a status line or
 * a gate that must not become the thing that breaks the session. Whatever is
 * wrong with the file, the gate reports it in full and this returns nothing.
 */
export function activeItem(store: Store): Item | undefined {
  try {
    return parseState(store.state).items.find((item) => isActive(item.status));
  } catch {
    return undefined;
  }
}
