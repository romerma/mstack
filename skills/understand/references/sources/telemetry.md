# Infrastructure telemetry — Datadog, Grafana, Honeycomb, Splunk

Answers "what was the system doing when this was written". Useful for explaining timeouts, retry
budgets, rate limits, batch sizes and cache TTLs — every magic number that looks arbitrary until
you see the graph it came from.

## How to search it

Anchor on a time window: the weeks before the target commit. Then look for latency percentiles,
error rates, saturation, and deploy markers on the same axis. Search logs for the exact strings
the code emits.

Alert and monitor definitions are the highest-value artifact here and the most overlooked: a
monitor's threshold is a written-down decision about what "too slow" means, with a date and an
author.

## What systematically lies here

- **Retention is short and silent.** Most of these systems keep raw data for weeks. If the code
  is a year old, the data that motivated it is gone, and an empty graph looks identical to a
  healthy one.
- **Dashboards get edited in place, with no history.** The panel you are looking at may not be
  the panel anyone looked at then.
- **Averages hide the incident.** A p50 that looks fine over a window containing a ten-minute
  outage is the normal case, not the exception. Ask for p99 and a narrow window.
- **A metric name is not its definition.** `request_duration` may or may not include queue time,
  and the answer changes the conclusion entirely. Find where it is emitted in the code.
- **Missing data plots as zero in many tools.** A dip to zero is as likely to be a broken
  collector as a real drop.

## What to return

The query or dashboard link, the exact time window, and the numbers — with units and percentile.
Note the retention limit explicitly whenever the window you wanted was not available.

## Rung it can reach

**2** for what the graph showed. The inference from "the graph showed this" to "that is why the
code is like this" is **rung 1** unless someone wrote it down somewhere else.
