# Sources for "why"

Code answers *how*. It cannot tell you what was rejected, and that is usually the part that
matters. This is where *why* is answered instead.

Spawn **one investigator per source you actually have**, each reading one playbook below and
nothing else. Narrow scopes, disjoint questions. Two investigators given the same broad question
return the same shallow answer twice.

| Category | Playbook | Written against |
|---|---|---|
| Source control history | [code-archaeology.md](sources/code-archaeology.md) | `git`, `gh` |
| Issue tracker | [tickets.md](sources/tickets.md) | Linear, Jira, GitHub Issues |
| Long-form documents | [documents.md](sources/documents.md) | Notion, Confluence, Google Docs |
| Team chat | [chat.md](sources/chat.md) | Slack, Discord, Teams |
| Error tracking | [error-tracking.md](sources/error-tracking.md) | Sentry, Rollbar, Bugsnag |
| Infrastructure telemetry | [telemetry.md](sources/telemetry.md) | Datadog, Grafana, Honeycomb |
| Analytics warehouse | [analytics.md](sources/analytics.md) | Snowflake, BigQuery, Databricks |

Add [incidents.md](sources/incidents.md) on top of the others when the target code looks
**defensive**: null guards, retries, timeouts, rate limits, feature flags, egress checks, OOM
handling. Defensive code is a scar. Something caused it.

## Two rules that outrank every playbook

**A source you could not reach is a gap, not an absence.** If the MCP is missing, unauthenticated,
or returns nothing, say *"Slack was not searchable"*. Never let an empty result become "there was
no discussion". A confident account built on a source that silently failed is worse than no
account.

**Quote, never paraphrase.** A summary of a decision is your reading of it. The reader needs the
sentence someone actually wrote, with a link and a date, so they can disagree with your reading.

## What these sources can prove

Every playbook ends with the highest rung of the
[evidence ladder](../../router/references/evidence-ladder.md) that source can reach. Read that
line before you believe your own write-up.

**No source here can get a claim about *why* past rung 2.** Someone said so, or you pointed at
where they said it. That ceiling is a property of intent rather than of the tools: a reason is
not a runtime property and cannot be executed, however good the source is.

Some of them do observe the running system — a Sentry event is production failing, a warehouse
query is production being used — and that is worth more about *behaviour* than pointing at a
line. It is still not a claim about why. If the account you are building says what the code does
today, that part needs the code, and it needs to be run.
