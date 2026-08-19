import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

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

  write(store.state, seedState(basename(root)), options.force === true, report, "state.json");
  write(store.current, CURRENT_TEMPLATE, options.force === true, report, "progress/current.md");
  write(store.history, HISTORY_TEMPLATE, false, report, "progress/history.md");

  ensureHeader(store.ledger, LEDGER_HEADER);
  report.ok("ledger.tsv ready");
  ensureHeader(store.decisions, DECISIONS_HEADER);
  report.ok("decisions.tsv ready");

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
