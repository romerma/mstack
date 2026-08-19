/**
 * The one place the lifecycle is defined.
 *
 * enxvo carries this same enum in six places (AGENTS.md, docs/specs.md,
 * feature_list.json:rules.valid_status, two init.sh queries, four more in the
 * gate script). Every copy is a chance for them to disagree, and `mstack
 * lint-plugin` fails the build if a second copy appears anywhere in the repo.
 */

export const STATUSES = [
  "pending",
  "specifying",
  "spec_ready",
  "in_progress",
  "reviewing",
  "verifying",
  "done",
  "blocked",
  "cancelled",
] as const;

export type Status = (typeof STATUSES)[number];

/** Statuses that occupy the single active slot in a worktree. */
export const ACTIVE_STATUSES = [
  "specifying",
  "spec_ready",
  "in_progress",
  "reviewing",
  "verifying",
] as const satisfies readonly Status[];

/** Statuses at or past which an `sdd` item must have its spec artifacts on disk. */
export const SPEC_REQUIRED_FROM = [
  "spec_ready",
  "in_progress",
  "reviewing",
  "verifying",
] as const satisfies readonly Status[];

export const TERMINAL_STATUSES = ["done", "cancelled"] as const satisfies readonly Status[];

/**
 * Legal transitions. `blocked` is reachable from any non-terminal status, so it
 * is handled in canTransition rather than listed nine times.
 */
export const TRANSITIONS: Readonly<Record<Status, readonly Status[]>> = {
  pending: ["specifying", "in_progress", "cancelled"],
  specifying: ["spec_ready", "pending", "cancelled"],
  spec_ready: ["in_progress", "specifying", "cancelled"],
  in_progress: ["reviewing", "cancelled"],
  reviewing: ["in_progress", "verifying", "cancelled"],
  verifying: ["done", "in_progress", "cancelled"],
  done: [],
  blocked: STATUSES.filter((s) => s !== "done" && s !== "blocked"),
  cancelled: ["pending"],
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isActive(status: Status): boolean {
  return (ACTIVE_STATUSES as readonly Status[]).includes(status);
}

export function requiresSpecArtifacts(status: Status): boolean {
  return (SPEC_REQUIRED_FROM as readonly Status[]).includes(status);
}

export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return true;
  if (to === "blocked") return from !== "done" && from !== "cancelled";
  return (TRANSITIONS[from] as readonly Status[]).includes(to);
}
