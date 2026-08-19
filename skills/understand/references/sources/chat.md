# Team chat — Slack, Discord, Teams

Frequently where the real decision was made, especially for changes too small to warrant a
document. Also the most ephemeral source you have: retention policies delete it, channels get
archived, and search quality decays with age.

## How to search it

Check the MCP's tool schema first, and whether it needs auth. If authentication fails, stop and
report the gap. Do not proceed as though the channel were empty.

1. **Author-bounded.** Messages from the PR author around the merge date. Narrowest, and it hits
   gold more often than any keyword.
2. **The PR URL**, or just `/pull/<number>`. PRs get linked when they are discussed.
3. **The error string**, verbatim, if the code handles a specific one. Surfaces incident threads.
4. **Channel-scoped**: `#eng-*`, `#proj-*`, `#incident-*`, `#sev-*`, the owning team's channel.
5. **Always fetch the whole thread.** The decision is usually in the replies, not the message
   that matched.

## What systematically lies here

- **Chat is casual, and casual reads like conclusion.** "lol just ship it" preceding the commit
  is not a decision. Look for a considered exchange with a tradeoff in it.
- **A single message out of its thread means something different.** This is the most common way
  to get chat evidence exactly backwards. Never quote a message you have not read in context.
- **The retention cliff is invisible.** If nothing turns up before some date, that date is
  probably the retention limit, not the start of the discussion. Say which it is.
- **DMs are where a lot of it happened, and they are not searchable.** A known, permanent gap.
  State it rather than letting silence imply consensus.
- **Reactions are not agreement.** A thumbs-up is not sign-off, and it is often the only thing
  that looks like one.

## What to return

Channel, permalink, participants, date range, and the **verbatim** quotes with attribution. Plus
one line naming what the thread was: a design discussion, an incident, a customer escalation.

## Rung it can reach

**2** at best, and only when you have the permalink and read the full thread. A paraphrase from
chat is rung 1.
