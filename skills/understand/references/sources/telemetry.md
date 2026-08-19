# Infrastructure telemetry — Datadog, Grafana, Honeycomb, Splunk

Answers "what was the system doing when this was written". Useful for explaining timeouts, retry
budgets, rate limits, batch sizes and cache TTLs — every magic number that looks arbitrary until
you see the graph it came from.

Do not assume the data has aged out. Metrics outlive the code that caused them more often than
not; it is logs and traces that vanish in weeks.

## How to search it

Anchor on a time window: the weeks before the target commit. Then look for latency percentiles,
error rates, saturation, and deploy markers on the same axis. Search logs for the exact strings
the code emits.

Alert and monitor definitions are the highest-value artifact here and the most overlooked: a
monitor's threshold is a written-down decision about what "too slow" means, with a date and an
author.

## What systematically lies here

- **Retention differs by signal, and the difference decides whether to look.** Metrics are
  usually long-lived — Datadog keeps them 15 months — so a year-old latency graph is very
  probably still there. Logs and traces are not: Datadog error tracking is around 15 days and
  indexed spans 15 to 30, Prometheus defaults to 15 days, Honeycomb to 60. Check the retention
  for the signal you want before concluding the data is gone, because an empty graph and a
  healthy one look identical.
- **A dashboard has version history, and almost nobody opens it.** Grafana keeps every previous
  version with diff and restore; Datadog offers preview, restore and clone from its version
  history. That history is dated and attributed, which makes it the one telemetry artifact that
  reads like a commit. Open the revision nearest the commit you are investigating: the panel
  live today may not be the panel anyone was looking at then, and the history is how you find
  out.
- **Averages hide the incident.** A p50 that looks fine over a window containing a ten-minute
  outage is the normal case, not the exception. Ask for p99 and a narrow window.
- **A metric name is not its definition.** `request_duration` may or may not include queue time,
  and the answer changes the conclusion entirely. Find where it is emitted in the code.
- **Missing data usually does not plot as zero — it gets interpolated away.** Datadog fills gauge
  gaps linearly by default, up to five minutes, and leaves count and rate gaps empty unless you
  ask for `default_zero()`; Grafana renders nulls as gaps. So the trap runs the other way from
  the obvious one: a short outage can be smoothed into a healthy-looking line, and a dip that
  really is zero is usually real. Treat a suspiciously smooth curve with as much suspicion as a
  spike.

## What to return

The query or dashboard link, the exact time window, and the numbers — with units and percentile.
Note the retention limit explicitly whenever the window you wanted was not available.

## Rung it can reach

**2** for what the graph showed. The inference from "the graph showed this" to "that is why the
code is like this" is **rung 1** unless someone wrote it down somewhere else.
