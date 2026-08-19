# Team chat — Slack, Discord, Teams

Frequently where the real decision was made, especially for changes too small to warrant a
document. How much of it survives depends entirely on a setting: a paid Slack workspace keeps
messages for the life of the workspace by default, and a workspace with a retention policy may
keep ninety days. Find out which before you interpret silence.

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
- **A retention cliff is invisible, and so is its absence.** If nothing turns up before some
  date, that date may be the retention limit or may be the start of the discussion. Check the
  workspace's retention setting rather than assuming deletion; on the default paid setting
  nothing was deleted at all, and attributing silence to retention would be inventing a gap.
- **Which DMs you can reach depends on the token.** Slack search covers DMs the searcher is in —
  `with:@person` — so an MCP holding a user token inherits that reach. A bot token cannot search
  DMs at all, and nobody can search other people's. Say which case you are in rather than
  declaring DMs unsearchable and letting silence imply consensus.
- **Reactions are not agreement.** A thumbs-up is not sign-off, and it is often the only thing
  that looks like one.

## What to return

Channel, permalink, participants, date range, and the **verbatim** quotes with attribution. Plus
one line naming what the thread was: a design discussion, an incident, a customer escalation.

## Rung it can reach

**2** at best, and only when you have the permalink and read the full thread. A paraphrase from
chat is rung 1.
