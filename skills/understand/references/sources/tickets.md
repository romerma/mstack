# Issue tracker — Linear, Jira, GitHub Issues

The place where the *ask* is recorded, which is a different thing from the reasoning. Best used
to establish what someone wanted and when, then to find the humans and links that lead to why.

## How to search it

Start from what the code already names: ticket IDs in commit messages, branch names, PR bodies.
Follow `closingIssuesReferences` from the PR. Then search the feature name and the key symbols,
including casual phrasings and misspellings.

Read the **comments and the status history**, not just the description. A ticket that bounced
between states, or that was reopened, has a story in it.

## What systematically lies here

- **The description is written before the work and rarely updated after.** It records what
  someone thought they were asking for. The comments record what actually got built.
- **"Done" may be a human click or a PR-merge automation.** Linear's GitHub integration moves a
  linked issue to Done when the PR merges, out of the box, and Jira does the same through
  automation. Either way it is not evidence anything worked — but if the automation set it, the
  ticket is carrying the PR reference, which is the thing this investigation is looking for.
  Check which one it was, and follow the link.
- **Duplicates and splits scatter the reasoning.** The real discussion is often on a ticket that
  was closed as a duplicate of the one you are reading.
- **Priority and estimate fields are political.** They record a negotiation, not an assessment.
- **A missing ticket means nothing.** Plenty of good work never gets one.

## What to return

Ticket ID and link, state and dates, the requester, and the **verbatim** lines that carry the
requirement or the constraint. Note explicitly when the description and the comments disagree —
that disagreement is often the most useful thing on the page.

## Rung it can reach

**2.** A linked ticket that states a constraint in writing is a real citation. It is a citation
about intent, not about behaviour.
