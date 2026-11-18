import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { item, quiesce, sandbox, state, trackCurrent } from "./helpers.ts";

/**
 * Shared by the item 43 tests (`decide-item-column`, `review-solo`,
 * `review-budget-gate`, `spec-size`): the real CLI, spawned under the runtime
 * the suite runs on, on a sandbox store in a throwaway git repository.
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");
const EXE = process.execPath.endsWith("bun")
  ? { exe: "bun", flags: [] as string[] }
  : { exe: process.execPath, flags: ["--disable-warning=ExperimentalWarning", "--experimental-strip-types"] };

/** Tests that spawn several CLIs say so, as `GATE_TEST` does in glossary.test.ts. */
export const SPAWNING = { timeout: 120_000 };

export type Box = ReturnType<typeof sandbox>;
export type Result = { code: number; stdout: string; stderr: string };

export function cli(box: Box, ...args: string[]): Result {
  const r = spawnSync(EXE.exe, [...EXE.flags, CLI, ...args], { cwd: box.store.root, encoding: "utf8", timeout: 30_000 });
  if (r.error !== undefined) throw r.error;
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export function put(box: Box, rel: string, text: string): void {
  mkdirSync(dirname(join(box.store.root, rel)), { recursive: true });
  writeFileSync(join(box.store.root, rel), text, "utf8");
}

/** A report body of exactly `bytes` bytes (ASCII), well above the stub floor. */
export function report(bytes: number): string {
  const head = "# Report\n\n";
  return head + "x".repeat(bytes - head.length - 1) + "\n";
}

export interface World {
  slug?: string;
  status?: string;
  base?: boolean;
  size?: string;
  sdd?: boolean;
  /** Files under .mstack/progress/, by name. */
  reports?: Record<string, string>;
  spec?: string;
}

/** An item with a base and a clean, committed store: the gate is green until a test makes it red. */
export function world(w: World = {}): Box {
  const box = sandbox();
  const slug = w.slug ?? "bud";
  for (const [name, text] of Object.entries(w.reports ?? {})) put(box, `.mstack/progress/${name}`, text);
  if (w.sdd === true) {
    for (const f of ["proposal.md", "design.md", "tasks.md"]) put(box, `.mstack/specs/${slug}/${f}`, `# ${f} of the item under test, long enough to count\n`);
    put(box, `.mstack/specs/${slug}/spec.md`, w.spec ?? "## ADDED Requirements\n\n### Requirement: R1 first\nThe system MUST.\n");
  }
  box.writeState(
    state([
      item({
        slug,
        status: w.status ?? "in_progress",
        acceptance: ["first criterion"],
        ...(w.base === false ? {} : { base: box.sha }),
        ...(w.size === undefined ? {} : { size: w.size }),
        ...(w.sdd === true ? { sdd: true } : {}),
      }),
    ]),
  );
  trackCurrent(box);
  quiesce(box);
  return box;
}

export function inWorld(w: World, body: (box: Box) => void): void {
  const box = world(w);
  try {
    body(box);
  } finally {
    box.dispose();
  }
}

/** `spec.md` text declaring R1..Rn. */
export function specWith(n: number): string {
  let out = "## ADDED Requirements\n";
  for (let i = 1; i <= n; i += 1) out += `\n### Requirement: R${i} number ${i}\nThe system MUST do ${i}.\n`;
  return out;
}
