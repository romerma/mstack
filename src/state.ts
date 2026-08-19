import { readFileSync, writeFileSync } from "node:fs";

import { isStatus, type Status } from "./lifecycle.ts";
import { UserError } from "./paths.ts";

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

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

export function findItem(state: State, ref: string): Item | undefined {
  const byId = Number.parseInt(ref, 10);
  return state.items.find((i) => i.slug === ref || (!Number.isNaN(byId) && i.id === byId));
}
