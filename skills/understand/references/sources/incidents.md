# Incidents and postmortems

Not a system of its own — a *lens*. Add it to the other sources when the target code looks
defensive: null guards, retries, timeouts, rate limits, circuit breakers, feature flags, egress
checks, OOM handling, a suspiciously specific constant.

Defensive code is a scar. Something caused it, and the postmortem is where that something was
written down properly, once, by people who had just been woken up by it.

## How to search it

Search the incident tracker, the `#incident-*` and `#sev-*` channels, and the document store for
the target's symptoms — the error string, the endpoint, the dependency name. Bound the search to
the months before the commit.

If the repo has a postmortem directory, read it before anything else. It is the cheapest source
in this whole directory.

## What systematically lies here

- **Blameless writing removes the specifics that would explain the code.** "A configuration error
  caused elevated latency" is what survives review; the actual sequence usually does not.
- **Action items are aspirational.** A postmortem listing five follow-ups is evidence that five
  follow-ups were proposed. Check whether each shipped before treating it as history.
- **The published timeline is reconstructed, and reconstructed timelines compress.** Times are
  approximate and ordering is sometimes wrong.
- **The severity reflects customer impact, not technical interest.** A SEV-3 can be the one that
  explains your code.

## What to return

The incident link and date, the **verbatim** trigger and impact lines, and the specific line of
code you believe it explains. If the connection is inference rather than a stated one, mark it as
inference — this is the source where a plausible story is easiest to construct and hardest to
check.

## Rung it can reach

**2** when the postmortem names the mitigation and the mitigation is your target. **1** when you
matched a symptom to a guard and it fit. That second case feels like the strongest finding of the
whole investigation and it is the weakest.
