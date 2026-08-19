# Error tracking — Sentry, Rollbar, Bugsnag

The best source for *what actually broke in front of users*, and the usual explanation for
defensive code. Reach for it when the target has a guard, a retry, or a catch you cannot account
for.

## How to search it

Search the exception class and the message string from the code. Search the file path and the
function name; most SDKs record them in the stack frame. Then read **first seen** and **last
seen** against the target's ship date — that correlation is the whole technique.

Pull a representative event, not just the issue summary. The stack trace and the breadcrumbs are
the evidence; the title is a fingerprint.

## What systematically lies here

- **An issue that stops is not an issue that was fixed.** Grouping is by fingerprint, so a rename
  or a refactor re-groups the *same* error under a new ID. When a series ends abruptly, look for
  a new issue starting the same day before concluding anything.
- **Release correlation is not causation.** A release carries many commits. "It stopped at
  v2.14.0" does not implicate your target; cross-reference the actual commit.
- **The error may have stopped because upstream changed.** Correlation suggests the fix. It does
  not establish authorship of it.
- **`resolved` is a button a human pressed.** It is a marker, not a code change.
- **Sampling makes rare errors of common ones.** A low event count may mean aggressive sampling.
  If the rate is not visible, say the count is unbounded below.
- **AI-generated issue summaries read as authoritative and are sometimes wrong.** Fall back to
  the events, the traces, and the timestamps.

## What to return

Issue ID and link, first and last seen, event count with sampling if known, affected releases,
and a **verbatim** stack trace excerpt showing why it is relevant. Plus the correlation to the
target's ship date, stated as correlation.

## Rung it can reach

**2** for "this error existed and looked like this" — you can point at the event. The causal
claim, that the target code is why it stopped, is **rung 1** unless you reproduce it.
