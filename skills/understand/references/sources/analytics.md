# Analytics warehouse — Snowflake, BigQuery, Databricks, dbt

Answers "who actually uses this, and how". The source that most often kills a proposed change
outright, by showing the path nobody believed was in use.

## How to search it

Find the event or table that corresponds to the code path, then get: volume over time, the
distribution across users or tenants, and the tail. The tail is the point — the argument for
keeping a code path is almost always a small number of heavy users, not the median.

Read the dbt model or the view definition before trusting a column. Its name is marketing; the
SQL is the contract.

## What systematically lies here

- **The pipeline drops events, and the loss is invisible downstream.** Client-side events are
  lost to ad blockers, offline sessions and crashes — precisely correlated with the failures you
  might be investigating.
- **A rename in the pipeline splits one behaviour into two series.** A metric that "went to zero"
  frequently just changed name.
- **Aggregates hide the tenant that matters.** Ninety-nine percent unused and one enterprise
  customer depending on it is the normal shape, and the aggregate reports it as dead.
- **Backfills rewrite history.** The same query can return different numbers on different days,
  with nothing to indicate it.
- **Definitions drift from the code silently.** The warehouse's idea of "active user" was
  defined once, by someone else, for another purpose.

## What to return

The query, verbatim, so someone can re-run it. The result with its time window. And the tail
explicitly: not just "0.3% of sessions" but who those sessions belong to.

## Rung it can reach

**2**, and only with the query attached. Without the query it is rung 1 — a number nobody can
reproduce is an assertion.
