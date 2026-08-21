import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { storeAt, type Store } from "./paths.ts";
import { Report } from "./report.ts";
import { ensureHeader } from "./tsv.ts";
import { HEADER as LEDGER_HEADER } from "./ledger.ts";
import { HEADER as DECISIONS_HEADER } from "./decisions.ts";

/**
 * `progress/current.md` is live state, overwritten every session.
 * `progress/history.md` is append-only and never edited.
 * Two files, opposite disciplines, and both survive a dead context window.
 */

/**
 * The two lines that mean "nobody has touched this yet". Exported so the gate
 * matches the template it actually writes instead of a copy that can drift.
 */
export const EMPTY_ITEM_LINE = "- **Item:** _none_";
export const EMPTY_NEXT_STEP = "_If this session dies right now, the first thing the next one should do._";

export const CURRENT_TEMPLATE = `# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to \`history.md\` and reset this file to the
> empty template below.

- **Item:** _none_
- **Status:** _-_
- **Branch:** _-_
- **Base:** _-_
- **Worktree:** _-_

## Plan

_Three to five bullets, written before touching code._

## Log

_Every significant step: files created, decisions taken, commands run, blockers hit._

- ...

## Verification

_Which rung of the evidence ladder this reached, and what proved it._

- ...

## Next step

_If this session dies right now, the first thing the next one should do._
`;

/**
 * The one file in the store that must not be committed.
 *
 * `verification.tsv` records that a command was executed *here*, keyed to the
 * commit it ran against. Committing it breaks both halves of that: the commit
 * moves HEAD and voids the receipt it is carrying, and a receipt from another
 * machine would let one worktree's run stand in for a run nobody in this one
 * ever did. Written into the store rather than the project's root `.gitignore`
 * so `mstack setup` never edits a file it does not own.
 */
export const STORE_GITIGNORE = `# Machine-local: which verification command ran here, at which commit.
# Never committed - a receipt is keyed to HEAD, so committing one voids it, and
# a receipt from another checkout is not evidence that anything ran in this one.
verification.tsv
`;

export const HISTORY_TEMPLATE = `# Session history (append-only)

> One entry per closed session, appended at the end. Never edit an earlier
> entry. If it turned out to be wrong, say so in a later one.
`;

export function seedState(project: string): string {
  return `${JSON.stringify(
    {
      version: 1,
      project,
      description: "Work queue for mstack sessions. One active item at a time, closed only on proof.",
      verify: "",
      rules: {
        one_active_item: true,
        require_verdict_to_close: true,
        require_spec_for_sdd_items: true,
      },
      items: [],
    },
    null,
    2,
  )}\n`;
}

export function setup(root: string, options: { force?: boolean } = {}): Report {
  const store: Store = storeAt(root);
  const report = new Report();

  mkdirSync(store.progress, { recursive: true });
  mkdirSync(store.specs, { recursive: true });

  // `--force` used to empty the work queue and report success. `history.md` was
  // protected by a literal `false` below, which means the question was asked
  // and `state.json` was left out of the answer — while the ledger survived,
  // leaving verdicts pointing at items that no longer existed.
  const populated = existingItems(store.state);
  if (populated > 0 && options.force === true) {
    report.fail(
      `state.json holds ${populated} item(s); --force would delete them and leave the ledger pointing at nothing`,
      "move or close the items first, or delete .mstack/ deliberately if that is what you mean",
    );
    report.summary();
    return report;
  }

  write(store.state, seedState(basename(root)), options.force === true, report, "state.json");
  write(store.current, CURRENT_TEMPLATE, options.force === true, report, "progress/current.md");
  write(store.history, HISTORY_TEMPLATE, false, report, "progress/history.md");

  ensureHeader(store.ledger, LEDGER_HEADER);
  report.ok("ledger.tsv ready");
  ensureHeader(store.decisions, DECISIONS_HEADER);
  report.ok("decisions.tsv ready");
  // Rewritten even when it exists, and it is the only file here that is: an
  // older store predates it, and one that silently loses the rule starts
  // committing receipts that void themselves.
  writeFileSync(join(store.dir, ".gitignore"), STORE_GITIGNORE, "utf8");
  report.ok(".mstack/.gitignore ready (verification.tsv is machine-local)");

  report.summary();
  return report;
}

function write(path: string, body: string, force: boolean, report: Report, label: string): void {
  if (existsSync(path) && !force) {
    report.ok(`${label} already exists, left alone`);
    return;
  }
  writeFileSync(path, body, "utf8");
  report.ok(`${label} written`);
}

/** Reset current.md to the empty template. Used at session close. */
export function resetCurrent(store: Store): void {
  writeFileSync(store.current, CURRENT_TEMPLATE, "utf8");
}

/** How many items the existing state file holds. Unreadable counts as none. */
function existingItems(file: string): number {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    const items = (value as { items?: unknown }).items;
    return Array.isArray(items) ? items.length : 0;
  } catch {
    return 0;
  }
}
